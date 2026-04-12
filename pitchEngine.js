/**
 * VoiceCrack – Pitch Engine
 * ══════════════════════════════════════════════════════════════════════
 * Pure logic layer: pitch detection, music math, voice analysis.
 * Framework-agnostic ES module – can be imported in Vanilla JS or
 * ported 1:1 into a React / TypeScript environment.
 *
 * Exports:
 *   noteFromPitch(freq)              Hz → MIDI note number
 *   noteNameFromPitch(note)          MIDI → human-readable string (e.g. "C4")
 *   yin(buf, sampleRate)             YIN pitch-detection algorithm
 *   createMedianFilter(size?)        Factory: stateful median smoother
 *   getVoiceSuggestion(min, max)     Returns { type, description, badge }
 */

// ── Note helpers ────────────────────────────────────────────────────────────

const NOTE_STRINGS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

/**
 * Convert a frequency in Hz to the nearest MIDI note number.
 * Reference: A4 = 440 Hz = MIDI 69.
 * @param {number} freq - Frequency in Hz
 * @returns {number} MIDI note number (integer)
 */
export function noteFromPitch(freq) {
    return Math.round(12 * (Math.log(freq / 440) / Math.log(2))) + 69;
}

/**
 * Return the human-readable name for a MIDI note.
 * Example: noteNameFromPitch(60) → "C4"
 * @param {number} note - MIDI note number
 * @returns {string}
 */
export function noteNameFromPitch(note) {
    return NOTE_STRINGS[note % 12] + (Math.floor(note / 12) - 1);
}

// ── YIN pitch-detection algorithm ──────────────────────────────────────────

/**
 * YIN algorithm (de Cheveigné & Kawahara, 2002).
 * Substantially more resistant to octave errors than autocorrelation.
 *
 * Pipeline:
 *   ① Difference function  d[τ] = Σ(x[i] − x[i+τ])²
 *   ② CMNDF               d′[τ] = d[τ] · τ / Σ_{j=1}^{τ} d[j]
 *   ③ First local minimum of d′[τ] below THRESHOLD
 *   ④ Parabolic interpolation → sub-sample precision
 *
 * @param {Float32Array} buf        Full PCM frame from AnalyserNode
 * @param {number}       sampleRate Audio context sample rate (e.g. 44100)
 * @returns {number} Fundamental frequency in Hz, or -1 if not found
 */
export function yin(buf, sampleRate) {
    const W         = buf.length >> 1;
    const TAU_MIN   = Math.max(2, Math.floor(sampleRate / 2000)); //  ~22 @44.1 kHz
    const TAU_MAX   = Math.min(W - 1, Math.ceil(sampleRate / 50)); // ~882 @44.1 kHz
    const THRESHOLD = 0.12; // compromise: 0.10 missed bass fundamentals (A1–E2),
                             // 0.15 caused octave-high errors (pseudo-min at τ/2 accepted).
                             // 0.12 covers CMNDF minima of deep notes without opening
                             // the octave-error window.

    // ① Difference function
    const d = new Float32Array(W);
    for (let tau = 1; tau <= TAU_MAX; tau++) {
        for (let i = 0; i < W; i++) {
            const delta = buf[i] - buf[i + tau];
            d[tau] += delta * delta;
        }
    }

    // ② Cumulative mean normalised difference (CMNDF)
    const cmndf = new Float32Array(W);
    cmndf[0] = 1;
    let runSum = 0;
    for (let tau = 1; tau < W; tau++) {
        runSum += d[tau];
        cmndf[tau] = runSum > 0 ? (d[tau] * tau) / runSum : 1;
    }

    // ③ Find first τ below THRESHOLD, walk to local minimum
    let tau = TAU_MIN;
    while (tau <= TAU_MAX) {
        if (cmndf[tau] < THRESHOLD) {
            while (tau + 1 <= TAU_MAX && cmndf[tau + 1] < cmndf[tau]) tau++;
            break;
        }
        tau++;
    }
    if (tau > TAU_MAX) return -1; // no clear pitch

    // ④ Parabolic interpolation for sub-sample precision
    if (tau > TAU_MIN && tau < TAU_MAX) {
        const s0 = cmndf[tau - 1], s1 = cmndf[tau], s2 = cmndf[tau + 1];
        const denom = s0 - 2 * s1 + s2;
        if (denom > 0) tau = tau + (s0 - s2) / (2 * denom);
    }

    return sampleRate / tau;
}

// ── Median filter (stateful factory) ───────────────────────────────────────

/**
 * Creates a stateful median filter for smoothing MIDI note values.
 * Eliminates single-frame spike notes caused by background noise.
 *
 * Usage:
 *   const filter = createMedianFilter(9);
 *   const smoothed = filter.push(rawMidi); // call each frame
 *   filter.reset();                         // call on recording start
 *
 * @param {number} size - Circular buffer size (default 9 frames)
 * @returns {{ push: (note: number) => number, reset: () => void }}
 */
export function createMedianFilter(size = 9) {
    const buf = [];
    return {
        push(note) {
            buf.push(note);
            if (buf.length > size) buf.shift();
            const sorted = [...buf].sort((a, b) => a - b);
            return sorted[Math.floor(sorted.length / 2)];
        },
        reset() { buf.length = 0; },
    };
}

// ── Voice-type suggestion engine ────────────────────────────────────────────

/**
 * Derives a voice-type suggestion from the observed pitch range.
 * Returns a plain object ready for direct UI rendering or further processing.
 *
 * Feature thresholds (MIDI):
 *   41  = F2  – deep bass floor
 *   50  = D3  – tenor lower bound
 *   71  = H4  – tenor upper bound
 *   76  = E5  – countertenor territory
 *
 * Priority order: extreme-range > very-low > tenor-range > very-high > middle
 *
 * @param {number} minPitch - Lowest stable MIDI note observed
 * @param {number} maxPitch - Highest stable MIDI note observed
 * @returns {{ type: string, description: string, badge: string }}
 */
export function getVoiceSuggestion(minPitch, maxPitch) {
    const isVeryLow     = minPitch <= 41;                   // F2-
    const isVeryHigh    = maxPitch >= 76;                   // E5+
    const hasTenorRange = minPitch <= 50 && maxPitch >= 71; // D3–H4

    // Special case: extreme full range
    if (isVeryLow && isVeryHigh) {
        return {
            type:        'Bass / Tenor',
            description: 'Extremer Gesamtumfang – du beherrschst sowohl tiefste Tiefen als auch strahlende Höhen.',
            badge:       'Power-Umfang',
        };
    }

    if (isVeryLow) {
        return {
            type:        'Bass',
            description: 'Dein tiefes Fundament ist ideal für den Bass.',
            badge:       'Tiefen-Spezialist',
        };
    }

    if (hasTenorRange) {
        return {
            type:        'Tenor',
            description: 'Dein Umfang deckt die typischen Tenor-Lagen gut ab.',
            badge:       'Allrounder',
        };
    }

    if (isVeryHigh) {
        return {
            type:        'Countertenor',
            description: 'Beeindruckende Höhe! Du könntest die Alt-Stimmen unterstützen.',
            badge:       'Höhen-Artist',
        };
    }

    return {
        type:        'Bariton',
        description: 'Deine Stimme liegt im soliden mittleren Bereich.',
        badge:       'Fundament',
    };
}

// ── Range Score ─────────────────────────────────────────────────────────────

/**
 * Converts an observed pitch range into a gamified score with tier label.
 *
 * Tier thresholds (semitones):
 *   < 6   → Aufwärmen  (grey)
 *   6–9   → Solide     (blue)
 *   10–13 → Gut        (green)
 *   14–17 → Stark      (violet)
 *   18–23 → Profi      (gold)
 *   ≥ 24  → Legende    (pink/red)
 *
 * @param {number} minPitch - Lowest stable MIDI note observed
 * @param {number} maxPitch - Highest stable MIDI note observed
 * @returns {{ semitones: number, tier: string, color: string }}
 */
export function getRangeScore(minPitch, maxPitch) {
    const semitones = maxPitch - minPitch;

    if (semitones < 6)  return { semitones, tier: 'Aufwärmen', color: '#94a3b8' };
    if (semitones < 10) return { semitones, tier: 'Solide',    color: '#60a5fa' };
    if (semitones < 14) return { semitones, tier: 'Gut',       color: '#34d399' };
    if (semitones < 18) return { semitones, tier: 'Stark',     color: '#a78bfa' };
    if (semitones < 24) return { semitones, tier: 'Profi',     color: '#fbbf24' };
                        return { semitones, tier: 'Legende',   color: '#f43f5e' };
}

