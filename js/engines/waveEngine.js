/**
 * waveEngine.js — Audio-Reactive Waveform Visualizer
 *
 * Two modes, seamlessly blended:
 *
 *   SPECTRUM mode (recording active):
 *     Reads real FFT frequency data from a Web Audio AnalyserNode.
 *     7 bars map to logarithmically-spaced vocal frequency bands:
 *       Band 1:  80 – 150 Hz   (sub-vocal / chest resonance)
 *       Band 2: 150 – 280 Hz   (low-mid warmth)
 *       Band 3: 280 – 500 Hz   (vowel low)
 *       Band 4: 500 – 900 Hz   (fundamental / vowel zone)
 *       Band 5: 900 – 1600 Hz  (mid-presence)
 *       Band 6: 1600 – 3000 Hz (upper presence / sibilance)
 *       Band 7: 3000 – 6000 Hz (brilliance / air)
 *     Bar colour: unified pitch-temperature colour (violet → cyan)
 *       so the singer sees both WHAT frequencies are active (height)
 *       AND WHAT NOTE they're singing (colour).
 *
 *   IDLE mode (no analyser / silence):
 *     Arch-shaped breathing animation at low amplitude.
 *
 * API:
 *   new WaveEngine(canvasEl, { pitchMin, pitchMax })
 *   .setAnalyser(analyserNode)  — called when recording starts
 *   .clearAnalyser()            — called when recording stops
 *   .frame(smoothedMidi, rms)   — feed MIDI pitch from recording loop (for colour)
 *   .reset()                    — signal idle
 *   .stop()                     — cancel internal RAF (page cleanup)
 */

const RMS_GATE    = 0.015;
const PITCH_MIN_D = 36;
const PITCH_MAX_D = 84;
const BAR_COUNT   = 7;

// Logarithmically-spaced frequency bands covering the vocal range
const FREQ_BANDS = [
    [  80,  150],   // 1: sub-vocal / chest resonance
    [ 150,  280],   // 2: low-mid warmth
    [ 280,  500],   // 3: vowel low
    [ 500,  900],   // 4: fundamental (vowel zone)
    [ 900, 1600],   // 5: mid-presence
    [1600, 3000],   // 6: upper presence / sibilance
    [3000, 6000],   // 7: brilliance / air
];

// Idle arch multipliers — mirror the favicon silhouette
const BAR_MULTS  = [0.36, 0.62, 0.84, 1.0, 0.84, 0.62, 0.36];
const BAR_PHASES = [0.0, 0.72, 1.44, 0.0, -1.44, -0.72, 0.0];

export class WaveEngine {

    #canvas;
    #ctx;
    #dpr      = window.devicePixelRatio || 1;
    #w        = 0;
    #h        = 0;
    #logicalW = 0;

    // Spectrum mode
    #analyser  = null;
    #freqData  = null;          // Uint8Array, updated each frame
    #barSmooth = new Array(BAR_COUNT).fill(0);  // per-bar EMA

    // Pitch colour (always updated from frame())
    #midi   = NaN;
    #isIdle = true;
    #phase  = 0;

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

    /**
     * Attach a real AnalyserNode — switches to spectrum mode.
     * @param {AnalyserNode} node
     */
    setAnalyser(node) {
        this.#analyser = node;
        this.#freqData = new Uint8Array(node.frequencyBinCount);
        this.#barSmooth.fill(0);
        this.#isIdle = false;
    }

    /** Detach analyser — returns to idle breathing animation. */
    clearAnalyser() {
        this.#analyser = null;
        this.#freqData = null;
        this.#isIdle   = true;
    }

    /**
     * Feed current pitch from the recording loop (used for colour only).
     * @param {number} smoothedMidi  EMA-smoothed MIDI note (or NaN)
     * @param {number} rms           Raw RMS (used to detect total silence)
     */
    frame(smoothedMidi, rms) {
        const silent = !isFinite(smoothedMidi) || rms < RMS_GATE;
        if (!silent && isFinite(smoothedMidi)) {
            this.#midi = isFinite(this.#midi)
                ? this.#ema(this.#midi, smoothedMidi, 0.08)
                : smoothedMidi;
        }
        // isIdle is controlled by setAnalyser/clearAnalyser, not here
    }

    reset() {
        this.#isIdle = true;
    }

    stop() {
        cancelAnimationFrame(this.#rafId);
        this.#rafId = null;
    }

    // ── Private ────────────────────────────────────────────────────

    #loop() {
        this.#draw();
        this.#rafId = requestAnimationFrame(() => this.#loop());
    }

    #draw() {
        const canvas = this.#canvas;
        const rect   = canvas.getBoundingClientRect();
        if (rect.width === 0) return;

        if (rect.width !== this.#logicalW) {
            this.#logicalW  = rect.width;
            this.#w         = Math.round(rect.width  * this.#dpr);
            this.#h         = Math.round(rect.height * this.#dpr);
            canvas.width    = this.#w;
            canvas.height   = this.#h;
        }

        const ctx = this.#ctx;
        const w = this.#w, h = this.#h, dpr = this.#dpr;
        ctx.clearRect(0, 0, w, h);

        // ── Colour from pitch ─────────────────────────────────────
        const norm = isFinite(this.#midi)
            ? Math.max(0, Math.min(1, (this.#midi - this.#pitchMin) / this.#pitchRange))
            : 0.28;
        const [cr, cg, cb] = this.#pitchRGB(norm);

        // ── Bar geometry ──────────────────────────────────────────
        const margin  = w * 0.07;
        const availW  = w - 2 * margin;
        const unit    = Math.floor(availW / (BAR_COUNT * 3 + (BAR_COUNT - 1)));
        const barW    = unit * 3;
        const gap     = unit;
        const totalW  = BAR_COUNT * barW + (BAR_COUNT - 1) * gap;
        const startX  = (w - totalW) / 2;
        const maxBarH = h * 0.82;
        const baseY   = h * 0.90;

        // ── Get bar heights ───────────────────────────────────────
        const heights = new Array(BAR_COUNT);

        if (this.#analyser && this.#freqData) {
            // ── SPECTRUM MODE ─────────────────────────────────────
            this.#phase += 0.048;
            this.#analyser.getByteFrequencyData(this.#freqData);
            const sr  = this.#analyser.context.sampleRate;
            const fft = this.#analyser.fftSize;

            for (let i = 0; i < BAR_COUNT; i++) {
                const [lo, hi] = FREQ_BANDS[i];
                const raw    = this.#bandLevel(this.#freqData, sr, fft, lo, hi);
                // Boost: vocal signal is rarely > 0.5 raw, scale up
                const scaled = Math.min(1, raw * 2.8);
                // Per-bar EMA: fast attack (0.4), slow decay (0.12)
                const alpha = scaled > this.#barSmooth[i] ? 0.4 : 0.12;
                this.#barSmooth[i] = this.#ema(this.#barSmooth[i], scaled, alpha);
                heights[i] = Math.max(5 * dpr, this.#barSmooth[i] * maxBarH);
            }
        } else {
            // ── IDLE / BREATHING MODE ─────────────────────────────
            this.#phase += 0.018;
            const amp = 0.35 + 0.10 * Math.sin(this.#phase * 0.65);
            for (let i = 0; i < BAR_COUNT; i++) {
                const wave  = 0.5 + 0.5 * Math.sin(this.#phase + BAR_PHASES[i]);
                const jit   = 0.86 + 0.14 * wave;
                heights[i]  = Math.max(6 * dpr, BAR_MULTS[i] * amp * maxBarH * jit);
            }
        }

        // ── Draw bars ─────────────────────────────────────────────
        for (let i = 0; i < BAR_COUNT; i++) {
            const barH = heights[i];
            const x = startX + i * (barW + gap);
            const y = baseY - barH;
            const r = Math.min(barW / 2, 5 * dpr);

            const grad = ctx.createLinearGradient(x, baseY, x, y);
            grad.addColorStop(0,    `rgba(${cr},${cg},${cb},0.10)`);
            grad.addColorStop(0.35, `rgba(${cr},${cg},${cb},0.55)`);
            grad.addColorStop(1,    `rgba(${cr},${cg},${cb},1.0)`);

            const isSpectrum = this.#analyser !== null;
            ctx.save();
            ctx.shadowColor = `rgba(${cr},${cg},${cb},${isSpectrum ? 0.90 : 0.70})`;
            ctx.shadowBlur  = (isSpectrum ? 16 : 10) * dpr;
            ctx.fillStyle   = grad;
            this.#roundedTop(ctx, x, y, barW, barH, r);
            ctx.fill();
            ctx.restore();
        }

        // ── Baseline ─────────────────────────────────────────────
        ctx.save();
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.20)`;
        ctx.lineWidth   = Math.round(dpr);
        ctx.beginPath();
        ctx.moveTo(startX - gap * 0.5,          baseY + dpr);
        ctx.lineTo(startX + totalW + gap * 0.5, baseY + dpr);
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Average the FFT magnitude in a frequency band, normalised 0–1.
     * @param {Uint8Array} freqData  From getByteFrequencyData()
     * @param {number}     sr        AudioContext.sampleRate
     * @param {number}     fftSize   analyser.fftSize
     * @param {number}     loHz      Band lower bound (Hz)
     * @param {number}     hiHz      Band upper bound (Hz)
     */
    #bandLevel(freqData, sr, fftSize, loHz, hiHz) {
        const binHz = sr / fftSize;
        const lo    = Math.max(0,                  Math.floor(loHz / binHz));
        const hi    = Math.min(freqData.length - 1, Math.ceil(hiHz  / binHz));
        if (lo >= hi) return 0;
        let sum = 0;
        for (let k = lo; k <= hi; k++) sum += freqData[k];
        return sum / ((hi - lo + 1) * 255);   // 0.0 – 1.0
    }

    #roundedTop(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h);
        ctx.closePath();
    }

    #ema(current, target, alpha) {
        return isNaN(current) ? target : current + alpha * (target - current);
    }

    #pitchRGB(norm) {
        const stops = [
            [0.00, 139,  92, 246],   // #8b5cf6  bass deep violet
            [0.33, 182, 160, 255],   // #b6a0ff  primary electric violet
            [0.66, 129, 140, 248],   // #818cf8  indigo
            [1.00,   0, 241, 254],   // #00f1fe  cyan
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
