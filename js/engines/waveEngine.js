/**
 * waveEngine.js — Unified Vocal Interface v3
 *
 * One canvas, two side-by-side zones sharing a common pitch-colour language:
 *
 *  ┌──EQ─────┬──────── Pitch History Trail ──────────────────────────┐
 *  │  ▬  7   │  C6 · · · · · · · · · · · · · · · · · · · · · · · ·  │
 *  │ ▬▬  6   │  C5 · · · · · · · · · · · · · · · · · · · · · · · ·  │
 *  │▬▬▬  5   │  C4 · · · · ●────────●●──────────●· · · · · · · · ·  │
 *  │ ▬▬  4   │  C3 · · · · · · · · · · · · · · · · · · · · · · · ·  │
 *  │  ▬  3   │  C2 · · · · · · · · · · · · · · · · · · · · · · · ·  │
 *  │  ·  2   │                                                        │
 *  │  ·  1   │                                                        │
 *  └─────────┴────────────────────────────────────────────────────────┘
 *   18%                        82%
 *
 * EQ (left):   7 horizontal bars growing rightward — subtle, low-opacity.
 *              Shows live frequency spectrum during recording; hidden in idle.
 *
 * Trail (right): Scrolling pitch line, Y = MIDI note.
 *              C-octave grid lines span the full canvas width, connecting zones.
 *
 * Colour: unified violet→cyan gradient driven by MIDI pitch register.
 *
 * API:
 *   new WaveEngine(canvasEl, { pitchMin, pitchMax })
 *   .setAnalyser(node)                    — attach AnalyserNode (recording start)
 *   .clearAnalyser()                      — detach (recording stop → idle)
 *   .frame(smoothedMidi, rms, trailMidi)  — feed each RAF frame
 *   .reset()                              — signal idle
 *   .stop()                               — cancel internal RAF (page cleanup)
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const RMS_GATE       = 0.015;
const PITCH_MIN_D    = 36;            // MIDI C2
const PITCH_MAX_D    = 84;            // MIDI C6
const TRAIL_DURATION = 14_000;        // ms of trail history visible

// Layout (fraction of canvas width)
const EQ_W_RATIO    = 0.18;           // EQ zone width
const GAP_W_RATIO   = 0.03;           // gap between EQ and trail
const TRAIL_X_RATIO = EQ_W_RATIO + GAP_W_RATIO;  // 0.21

// 7 vocal frequency bands (logarithmically spaced)
const FREQ_BANDS = [
    [  80,  150],
    [ 150,  280],
    [ 280,  500],
    [ 500,  900],
    [ 900, 1600],
    [1600, 3000],
    [3000, 6000],
];

// Per-band noise gates (higher for low bands that carry room noise)
const BAND_GATES = [0.28, 0.22, 0.15, 0.08, 0.06, 0.05, 0.04];

const BAR_COUNT = 7;

// C-note grid reference lines
const C_OCTAVES = [
    { midi: 36, label: 'C2' },
    { midi: 48, label: 'C3' },
    { midi: 60, label: 'C4' },
    { midi: 72, label: 'C5' },
    { midi: 84, label: 'C6' },
];

// ── Class ─────────────────────────────────────────────────────────────────────

export class WaveEngine {

    #canvas;
    #ctx;
    #dpr       = window.devicePixelRatio || 1;
    #w         = 0;
    #h         = 0;
    #logicalW  = 0;

    // Spectrum
    #analyser  = null;
    #freqData  = null;
    #barSmooth = new Array(BAR_COUNT).fill(0);

    // Pitch trail
    #trail     = [];           // [{midi, t}] — NaN midi = silence gap

    // Shared state
    #midi      = NaN;
    #isIdle    = true;
    #phase     = 0;

    #pitchMin;
    #pitchMax;
    #pitchRange;

    #rafId = null;

    constructor(canvasEl, { pitchMin = PITCH_MIN_D, pitchMax = PITCH_MAX_D } = {}) {
        this.#canvas     = canvasEl;
        this.#ctx        = canvasEl.getContext('2d');
        this.#pitchMin   = pitchMin;
        this.#pitchMax   = pitchMax;
        this.#pitchRange = pitchMax - pitchMin;
        this.#loop();
    }

    /** Attach AnalyserNode → spectrum mode, fresh trail. */
    setAnalyser(node) {
        this.#analyser = node;
        this.#freqData = new Uint8Array(node.frequencyBinCount);
        this.#barSmooth.fill(0);
        this.#trail    = [];
        this.#isIdle   = false;
    }

    /** Detach → idle mode.  Trail is kept so singer can review after stopping. */
    clearAnalyser() {
        this.#analyser = null;
        this.#freqData = null;
        this.#isIdle   = true;
    }

    /**
     * Feed values each recording frame.
     * @param {number} smoothedMidi  EMA-smoothed MIDI (colour)
     * @param {number} rms           Raw RMS amplitude
     * @param {number} [trailMidi]   Median-filtered MIDI for trail (or NaN for gap)
     */
    frame(smoothedMidi, rms, trailMidi = NaN) {
        const silent = !isFinite(smoothedMidi) || rms < RMS_GATE;
        if (!silent && isFinite(smoothedMidi)) {
            this.#midi = isFinite(this.#midi)
                ? this.#ema(this.#midi, smoothedMidi, 0.08)
                : smoothedMidi;
        }
        // Accumulate trail only while recording
        if (this.#analyser) {
            const now = performance.now();
            this.#trail.push({ midi: isFinite(trailMidi) ? trailMidi : NaN, t: now });
            const cutoff = now - TRAIL_DURATION;
            while (this.#trail.length && this.#trail[0].t < cutoff) this.#trail.shift();
        }
    }

    reset() { this.#isIdle = true; }

    stop() {
        cancelAnimationFrame(this.#rafId);
        this.#rafId = null;
    }

    // ── Private ───────────────────────────────────────────────────────────────

    #loop() {
        this.#draw();
        this.#rafId = requestAnimationFrame(() => this.#loop());
    }

    #draw() {
        const canvas = this.#canvas;
        const rect   = canvas.getBoundingClientRect();
        if (rect.width === 0) return;

        if (rect.width !== this.#logicalW) {
            this.#logicalW = rect.width;
            this.#w        = Math.round(rect.width  * this.#dpr);
            this.#h        = Math.round(rect.height * this.#dpr);
            canvas.width   = this.#w;
            canvas.height  = this.#h;
        }

        const ctx = this.#ctx;
        const w = this.#w, h = this.#h, dpr = this.#dpr;
        ctx.clearRect(0, 0, w, h);

        // ── Advance phase (idle breathing for EQ) ─────────────────
        this.#phase += this.#isIdle ? 0.016 : 0.048;

        // ── Colour from pitch ─────────────────────────────────────
        const norm = isFinite(this.#midi)
            ? Math.max(0, Math.min(1, (this.#midi - this.#pitchMin) / this.#pitchRange))
            : 0.28;
        const [cr, cg, cb] = this.#pitchRGB(norm);

        // ── Geometry ──────────────────────────────────────────────
        const padV    = Math.round(h * 0.08);
        const innerH  = h - 2 * padV;
        const eqZoneW = Math.round(w * EQ_W_RATIO);
        const trailX  = Math.round(w * TRAIL_X_RATIO);
        const trailW  = w - trailX;

        // 1. Full-width grid (behind both zones)
        this.#drawGrid(ctx, w, h, padV, innerH, dpr, cr, cg, cb);

        // 2. EQ horizontal bars (left zone)
        this.#drawEQH(ctx, eqZoneW, h, padV, innerH, dpr, cr, cg, cb);

        // 3. Pitch trail (right zone)
        this.#drawTrail(ctx, trailX, trailW, h, padV, innerH, dpr, cr, cg, cb);
    }

    // ── Grid ──────────────────────────────────────────────────────────────────

    #drawGrid(ctx, w, h, padV, innerH, dpr, cr, cg, cb) {
        ctx.save();
        ctx.setLineDash([2 * dpr, 6 * dpr]);
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.10)`;
        ctx.lineWidth   = Math.round(dpr);
        ctx.font        = `${Math.round(9 * dpr)}px system-ui, sans-serif`;
        ctx.textAlign   = 'right';
        ctx.fillStyle   = `rgba(${cr},${cg},${cb},0.28)`;

        for (const { midi, label } of C_OCTAVES) {
            const yn = (midi - this.#pitchMin) / this.#pitchRange;
            const y  = padV + innerH - Math.round(yn * innerH);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
            ctx.fillText(label, w - 4 * dpr, y - 3 * dpr);
        }

        ctx.setLineDash([]);
        ctx.restore();
    }

    // ── EQ Horizontal Bars ────────────────────────────────────────────────────

    #drawEQH(ctx, zoneW, h, padV, innerH, dpr, cr, cg, cb) {
        // EQ is only shown during active recording (not in idle)
        if (!this.#analyser || !this.#freqData) return;

        this.#analyser.getByteFrequencyData(this.#freqData);
        const sr  = this.#analyser.context.sampleRate;
        const fft = this.#analyser.fftSize;

        const segH  = innerH / BAR_COUNT;
        const barH  = Math.max(2 * dpr, segH * 0.38);   // 38% fill, rest is gap

        for (let i = 0; i < BAR_COUNT; i++) {
            // i = 0 → band 1 (bass) at bottom; i = 6 → band 7 (treble) at top
            const [lo, hi] = FREQ_BANDS[i];
            const raw   = this.#bandLevel(this.#freqData, sr, fft, lo, hi);
            const gate  = BAND_GATES[i];
            const gated = raw < gate ? 0 : (raw - gate) / (1 - gate);
            const scaled = Math.min(1, gated * 1.3);

            const attackA = 0.18;
            const decayA  = i < 3 ? 0.14 : 0.08;
            const alpha   = scaled > this.#barSmooth[i] ? attackA : decayA;
            this.#barSmooth[i] = this.#ema(this.#barSmooth[i], scaled, alpha);

            const barW   = Math.max(2 * dpr, this.#barSmooth[i] * zoneW * 0.90);
            const yCenter = padV + innerH - segH * (i + 0.5);
            const y      = Math.round(yCenter - barH / 2);
            const r      = Math.min(barH / 2, 3 * dpr);

            // Gradient: solid left → fade to transparent right
            const grad = ctx.createLinearGradient(0, 0, barW, 0);
            grad.addColorStop(0,   `rgba(${cr},${cg},${cb},0.55)`);
            grad.addColorStop(0.7, `rgba(${cr},${cg},${cb},0.25)`);
            grad.addColorStop(1,   `rgba(${cr},${cg},${cb},0.04)`);

            ctx.save();
            ctx.fillStyle = grad;
            this.#roundedRight(ctx, 0, y, barW, barH, r);
            ctx.fill();
            ctx.restore();
        }
    }

    // ── Pitch Trail ───────────────────────────────────────────────────────────

    #drawTrail(ctx, startX, trailW, h, padV, innerH, dpr, cr, cg, cb) {
        const now = performance.now();

        if (this.#trail.length < 2) return;


        ctx.save();
        ctx.lineWidth   = 2.5 * dpr;
        ctx.lineJoin    = 'round';
        ctx.lineCap     = 'round';
        ctx.shadowColor = `rgba(${cr},${cg},${cb},0.70)`;
        ctx.shadowBlur  = 7 * dpr;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},1.0)`;

        ctx.beginPath();
        let pen = false;

        for (const pt of this.#trail) {
            const xf = (pt.t - (now - TRAIL_DURATION)) / TRAIL_DURATION;
            const x  = Math.round(startX + xf * trailW);

            if (!isFinite(pt.midi)) { pen = false; continue; }

            const yn = (pt.midi - this.#pitchMin) / this.#pitchRange;
            const y  = Math.round(padV + innerH - Math.max(0, Math.min(1, yn)) * innerH);

            if (!pen) { ctx.moveTo(x, y); pen = true; }
            else       { ctx.lineTo(x, y); }
        }

        ctx.stroke();
        ctx.restore();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Rounded-right rectangle: left corners are square, right corners rounded. */
    #roundedRight(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
    }

    #bandLevel(freqData, sr, fftSize, loHz, hiHz) {
        const binHz = sr / fftSize;
        const lo    = Math.max(0,                   Math.floor(loHz / binHz));
        const hi    = Math.min(freqData.length - 1, Math.ceil(hiHz  / binHz));
        if (lo >= hi) return 0;
        let sum = 0;
        for (let k = lo; k <= hi; k++) sum += freqData[k];
        return sum / ((hi - lo + 1) * 255);
    }

    #ema(current, target, alpha) {
        return isNaN(current) ? target : current + alpha * (target - current);
    }

    /**
     * Pitch → RGB colour:
     *   0.00 → #8b5cf6  deep violet (bass)
     *   0.33 → #b6a0ff  electric violet (baritone)
     *   0.66 → #818cf8  indigo (tenor/alto)
     *   1.00 → #00f1fe  cyan (soprano)
     */
    #pitchRGB(norm) {
        const stops = [
            [0.00, 139,  92, 246],
            [0.33, 182, 160, 255],
            [0.66, 129, 140, 248],
            [1.00,   0, 241, 254],
        ];
        for (let i = 0; i < stops.length - 1; i++) {
            const [n0, r0, g0, b0] = stops[i];
            const [n1, r1, g1, b1] = stops[i + 1];
            if (norm <= n1) {
                const t = (norm - n0) / (n1 - n0);
                return [
                    Math.round(r0 + t * (r1 - r0)),
                    Math.round(g0 + t * (g1 - g0)),
                    Math.round(b0 + t * (b1 - b0)),
                ];
            }
        }
        return [0, 241, 254];
    }
}
