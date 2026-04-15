/**
 * VocalRange – Pitch Engine
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
 *   getVoiceSuggestion(min, max)     Returns { type, description, badge } (SATB)
 *   getRangeScore(min, max)          Returns { semitones, tier, color }
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
    const THRESHOLD = 0.11; // 0.10 misses bass fundamentals (A1–E2).
                             // 0.12 occasionally accepts pseudo-min at τ/2 → octave jumps.
                             // 0.11 eliminates most octave errors without losing C2–E2.

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

// ── Voice-type suggestion engine — SATB ────────────────────────────────────

/**
 * Derives a SATB voice-type suggestion from the observed pitch range.
 * Works universally for all voice types (male and female).
 *
 * Classification method:
 *   primary  — centre of range: (minPitch + maxPitch) / 2
 *   tiebreak — minPitch to separate Tenor from Alto in the overlap zone
 *
 * SATB + Baritone + Mezzo-Soprano centre thresholds (MIDI):
 *   centre <  53                    → Bass
 *   centre <  58                    → Baritone
 *   centre <  65, minPitch ≤ 53     → Tenor   (can descend to ≈ F3)
 *   centre <  65, minPitch >  53    → Alto    (female lower bound higher)
 *   centre <  70                    → Mezzo-Soprano
 *   centre ≥  70                    → Soprano
 *   special: range ≥ 28 ST spanning bass + treble → Full Range
 *
 * @param {number} minPitch  Lowest stable MIDI note observed
 * @param {number} maxPitch  Highest stable MIDI note observed
 * @returns {{ type: string, description: string, badge: string }}
 */
export function getVoiceSuggestion(minPitch, maxPitch) {
    const centre    = (minPitch + maxPitch) / 2;
    const semitones = maxPitch - minPitch;

    // Special: extraordinary wide compass spanning bass + high treble
    if (semitones >= 28 && minPitch <= 45 && maxPitch >= 72) {
        return {
            type:        'Full Range',
            description: 'Extraordinary compass — you span from bass depths to brilliant highs.',
            badge:       'Full Compass',
        };
    }

    if (centre < 53) {
        return {
            type:        'Bass',
            description: 'Your deep, resonant voice anchors the ensemble.',
            badge:       'Deep Foundation',
        };
    }
    if (centre < 58) {
        return {
            type:        'Baritone',
            description: 'Your voice bridges bass and tenor with rich, warm tones.',
            badge:       'The Bridge',
        };
    }
    if (centre < 65) {
        // Tenor / Alto overlap zone — lowest note is the discriminator
        if (minPitch <= 53) {
            return {
                type:        'Tenor',
                description: 'Your bright voice carries the melody with powerful highs.',
                badge:       'Leading Voice',
            };
        }
        return {
            type:        'Alto',
            description: 'Your strong lower register lends warmth to every harmony.',
            badge:       'Warm & Deep',
        };
    }
    if (centre < 70) {
        return {
            type:        'Mezzo-Soprano',
            description: 'Your voice blends warmth with brilliance across a wide range.',
            badge:       'The Blend',
        };
    }
    return {
        type:        'Soprano',
        description: 'Your bright, soaring voice lights up the highest registers.',
        badge:       'High Flight',
    };
}

// ── Range Score ─────────────────────────────────────────────────────────────

/**
 * Converts an observed pitch range into a gamified score with tier label.
 *
 * Tier thresholds (semitones):
 *   <  6  → Warm Up  (slate)
 *    6–9  → Solid    (blue)
 *   10–13 → Good     (green)
 *   14–17 → Strong   (violet)
 *   18–23 → Pro      (gold)
 *   ≥ 24  → Legend   (rose / red)
 *
 * @param {number} minPitch  Lowest stable MIDI note observed
 * @param {number} maxPitch  Highest stable MIDI note observed
 * @returns {{ semitones: number, tier: string, color: string }}
 */
export function getRangeScore(minPitch, maxPitch) {
    const semitones = maxPitch - minPitch;

    if (semitones <  6) return { semitones, tier: 'Warm Up', color: '#94a3b8' };
    if (semitones < 10) return { semitones, tier: 'Solid',   color: '#60a5fa' };
    if (semitones < 14) return { semitones, tier: 'Good',    color: '#34d399' };
    if (semitones < 18) return { semitones, tier: 'Strong',  color: '#a78bfa' };
    if (semitones < 24) return { semitones, tier: 'Pro',     color: '#fbbf24' };
                        return { semitones, tier: 'Legend',  color: '#f43f5e' };
}
