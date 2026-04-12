/**
 * waveEngine.js — Unified Vocal Interface
 *
 * One canvas, two integrated vertical zones sharing a common pitch-colour language:
 *
 *  ┌──────────────────────────────────────────┐
 *  │  PITCH HISTORY (scrolling, Y = MIDI)     │  55 % of canvas
 *  │  Grid lines at C2 C3 C4 C5 C6           │
 *  ├──────────────────────────────────────────┤  divider
 *  │  ▌  ▌▌ ▌▌▌ ▌▌▌ ▌▌ ▌▌ ▌  ▌             │  38 % of canvas
 *  │  FREQUENCY SPECTRUM (7 vocal bands)      │
 *  └──────────────────────────────────────────┘
 *
 * Colour: same violet → cyan gradient for both zones,
 *         driven by the singer's current MIDI pitch.
 *
 * Scalar mappings:
 *   RMS    → EQ bar height + glow intensity
 *   Pitch  → unified colour temperature
 *   Time   → trail X position (right = now, left = past)
 *
 * API:
 *   new WaveEngine(canvasEl, { pitchMin, pitchMax })
 *   .setAnalyser(node)           — attach AnalyserNode (recording start)
 *   .clearAnalyser()             — detach (recording stop → idle)
 *   .frame(smoothedMidi, rms, trailMidi)  — feed each RAF frame
 *   .reset()                     — signal idle
 *   .stop()                      — cancel internal RAF (page cleanup)
 */

// ── Constants ────────────────────────────────────────────────────────────────

const RMS_GATE       = 0.015;
const PITCH_MIN_D    = 36;           // MIDI C2
const PITCH_MAX_D    = 84;           // MIDI C6
const TRAIL_DURATION = 14_000;       // ms of trail history visible

// Layout ratios (of total canvas height)
const TRAIL_RATIO    = 0.54;         // pitch trail area
const GAP_RATIO      = 0.06;         // space between trail and EQ
const EQ_RATIO       = 0.33;         // EQ bars area

// 7 logarithmically-spaced vocal frequency bands
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

const BAR_COUNT  = 7;
const BAR_MULTS  = [0.36, 0.62, 0.84, 1.0, 0.84, 0.62, 0.36]; // idle arch
const BAR_PHASES = [0.0,  0.72, 1.44, 0.0, -1.44, -0.72, 0.0];

// C-note MIDI values for grid labels
const C_OCTAVES = [
    { midi: 36, label: 'C2' },
    { midi: 48, label: 'C3' },
    { midi: 60, label: 'C4' },
    { midi: 72, label: 'C5' },
    { midi: 84, label: 'C6' },
];

// ── Class ────────────────────────────────────────────────────────────────────

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
    #trail     = [];          // [{midi, t}]  — NaN midi = silence gap

    // Shared pitch colour state
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

    /** Attach a real AnalyserNode → spectrum mode. */
    setAnalyser(node) {
        this.#analyser = node;
        this.#freqData = new Uint8Array(node.frequencyBinCount);
        this.#barSmooth.fill(0);
        this.#trail    = [];      // fresh trail for new session
        this.#isIdle   = false;
    }

    /** Detach analyser → idle breathing mode. */
    clearAnalyser() {
        this.#analyser = null;
        this.#freqData = null;
        this.#isIdle   = true;
        // keep trail so singer can review after stopping
    }

    /**
     * Feed live values from the recording loop each frame.
     * @param {number} smoothedMidi  EMA-smoothed MIDI (colour)
     * @param {number} rms           Raw RMS amplitude
     * @param {number} [trailMidi]   Median-filtered MIDI for trail line (or NaN)
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
            // Prune entries older than visible window
            const cutoff = now - TRAIL_DURATION;
            while (this.#trail.length && this.#trail[0].t < cutoff) {
                this.#trail.shift();
            }
        }
    }

    reset() { this.#isIdle = true; }

    stop() {
        cancelAnimationFrame(this.#rafId);
        this.#rafId = null;
    }

    // ── Private ──────────────────────────────────────────────────────────────

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

        // ── Zone geometry ─────────────────────────────────────────
        const trailH  = Math.round(h * TRAIL_RATIO);
        const eqTop   = trailH + Math.round(h * GAP_RATIO);
        const eqH     = Math.round(h * EQ_RATIO);
        const baseY   = eqTop + eqH;

        // ── Colour from pitch ─────────────────────────────────────
        const norm = isFinite(this.#midi)
            ? Math.max(0, Math.min(1, (this.#midi - this.#pitchMin) / this.#pitchRange))
            : 0.28;
        const [cr, cg, cb] = this.#pitchRGB(norm);

        // ── Draw pitch trail (top zone) ───────────────────────────
        this.#drawTrail(ctx, w, trailH, dpr, cr, cg, cb);

        // ── Divider ───────────────────────────────────────────────
        const divY = trailH + Math.round(h * GAP_RATIO * 0.5);
        const divG = ctx.createLinearGradient(0, 0, w, 0);
        divG.addColorStop(0,   'transparent');
        divG.addColorStop(0.2, `rgba(${cr},${cg},${cb},0.18)`);
        divG.addColorStop(0.8, `rgba(${cr},${cg},${cb},0.18)`);
        divG.addColorStop(1,   'transparent');
        ctx.save();
        ctx.strokeStyle = divG;
        ctx.lineWidth   = Math.round(dpr);
        ctx.beginPath();
        ctx.moveTo(0, divY);
        ctx.lineTo(w, divY);
        ctx.stroke();
        ctx.restore();

        // ── Draw EQ bars (bottom zone) ────────────────────────────
        this.#drawEQ(ctx, w, eqTop, eqH, baseY, dpr, cr, cg, cb);
    }

    // ── Trail ─────────────────────────────────────────────────────────────────

    #drawTrail(ctx, w, h, dpr, cr, cg, cb) {
        const padV  = Math.round(h * 0.10);   // vertical padding
        const innerH = h - 2 * padV;           // usable height
        const now   = performance.now();

        // ── C-octave grid lines ──────────────────────────────────
        ctx.save();
        ctx.font      = `${Math.round(9 * dpr)}px system-ui, sans-serif`;
        ctx.textAlign = 'left';

        for (const { midi, label } of C_OCTAVES) {
            const yn = (midi - this.#pitchMin) / this.#pitchRange;
            const y  = (h - padV) - yn * innerH;

            // line
            ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.12)`;
            ctx.lineWidth   = Math.round(dpr);
            ctx.setLineDash([3 * dpr, 5 * dpr]);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();

            // label
            ctx.fillStyle = `rgba(${cr},${cg},${cb},0.35)`;
            ctx.fillText(label, 4 * dpr, y - 3 * dpr);
        }
        ctx.setLineDash([]);
        ctx.restore();

        // ── Trail line ───────────────────────────────────────────
        if (this.#trail.length < 2) {
            // Idle hint text
            if (this.#isIdle) {
                ctx.save();
                ctx.fillStyle = `rgba(${cr},${cg},${cb},0.22)`;
                ctx.font      = `${Math.round(11 * dpr)}px system-ui, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('sing to see your pitch trail', w / 2, h / 2);
                ctx.restore();
            }
            return;
        }

        ctx.save();
        ctx.lineWidth   = 2.5 * dpr;
        ctx.lineJoin    = 'round';
        ctx.lineCap     = 'round';
        ctx.shadowColor = `rgba(${cr},${cg},${cb},0.75)`;
        ctx.shadowBlur  = 8 * dpr;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},1.0)`;

        ctx.beginPath();
        let pen = false;

        for (const pt of this.#trail) {
            const xf = (pt.t - (now - TRAIL_DURATION)) / TRAIL_DURATION;
            const x  = Math.round(xf * w);

            if (!isFinite(pt.midi)) {
                pen = false;
                continue;
            }

            const yn = (pt.midi - this.#pitchMin) / this.#pitchRange;
            const y  = (h - padV) - Math.max(0, Math.min(1, yn)) * innerH;

            if (!pen) { ctx.moveTo(x, y); pen = true; }
            else       { ctx.lineTo(x, y); }
        }
        ctx.stroke();
        ctx.restore();
    }

    // ── EQ Bars ───────────────────────────────────────────────────────────────

    #drawEQ(ctx, w, eqTop, eqH, baseY, dpr, cr, cg, cb) {
        // Bar geometry
        const margin  = w * 0.07;
        const availW  = w - 2 * margin;
        const unit    = Math.floor(availW / (BAR_COUNT * 3 + (BAR_COUNT - 1)));
        const barW    = unit * 3;
        const gap     = unit;
        const totalW  = BAR_COUNT * barW + (BAR_COUNT - 1) * gap;
        const startX  = (w - totalW) / 2;
        const maxBarH = eqH;

        // Get heights
        const heights = new Array(BAR_COUNT);

        if (this.#analyser && this.#freqData) {
            // ── Spectrum mode ────────────────────────────────────
            this.#phase += 0.048;
            this.#analyser.getByteFrequencyData(this.#freqData);
            const sr  = this.#analyser.context.sampleRate;
            const fft = this.#analyser.fftSize;

            for (let i = 0; i < BAR_COUNT; i++) {
                const [lo, hi] = FREQ_BANDS[i];
                const raw      = this.#bandLevel(this.#freqData, sr, fft, lo, hi);
                const gate     = BAND_GATES[i];
                const gated    = raw < gate ? 0 : (raw - gate) / (1 - gate);
                const scaled   = Math.min(1, gated * 1.3);
                const attackA  = 0.18;
                const decayA   = i < 3 ? 0.14 : 0.08;
                const alpha    = scaled > this.#barSmooth[i] ? attackA : decayA;
                this.#barSmooth[i] = this.#ema(this.#barSmooth[i], scaled, alpha);
                heights[i] = Math.max(4 * dpr, this.#barSmooth[i] * maxBarH);
            }
        } else {
            // ── Idle breathing mode ───────────────────────────────
            this.#phase += 0.018;
            const amp = 0.35 + 0.10 * Math.sin(this.#phase * 0.65);
            for (let i = 0; i < BAR_COUNT; i++) {
                const wave = 0.5 + 0.5 * Math.sin(this.#phase + BAR_PHASES[i]);
                heights[i] = Math.max(6 * dpr, BAR_MULTS[i] * amp * maxBarH * (0.86 + 0.14 * wave));
            }
        }

        // Draw bars
        for (let i = 0; i < BAR_COUNT; i++) {
            const barH = heights[i];
            const x    = startX + i * (barW + gap);
            const y    = baseY - barH;
            const r    = Math.min(barW / 2, 5 * dpr);

            const grad = ctx.createLinearGradient(x, baseY, x, y);
            grad.addColorStop(0,    `rgba(${cr},${cg},${cb},0.10)`);
            grad.addColorStop(0.35, `rgba(${cr},${cg},${cb},0.55)`);
            grad.addColorStop(1,    `rgba(${cr},${cg},${cb},1.0)`);

            ctx.save();
            ctx.shadowColor = `rgba(${cr},${cg},${cb},${this.#analyser ? 0.85 : 0.65})`;
            ctx.shadowBlur  = (this.#analyser ? 14 : 8) * dpr;
            ctx.fillStyle   = grad;
            this.#roundedTop(ctx, x, y, barW, barH, r);
            ctx.fill();
            ctx.restore();
        }

        // Baseline
        ctx.save();
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.20)`;
        ctx.lineWidth   = Math.round(dpr);
        ctx.beginPath();
        ctx.moveTo(startX - gap * 0.5,          baseY + dpr);
        ctx.lineTo(startX + totalW + gap * 0.5, baseY + dpr);
        ctx.stroke();
        ctx.restore();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    #bandLevel(freqData, sr, fftSize, loHz, hiHz) {
        const binHz = sr / fftSize;
        const lo    = Math.max(0,                   Math.floor(loHz / binHz));
        const hi    = Math.min(freqData.length - 1, Math.ceil(hiHz  / binHz));
        if (lo >= hi) return 0;
        let sum = 0;
        for (let k = lo; k <= hi; k++) sum += freqData[k];
        return sum / ((hi - lo + 1) * 255);
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

    /**
     * Pitch → RGB colour:
     *   0.00 → #8b5cf6 deep violet (bass)
     *   0.33 → #b6a0ff electric violet (baritone)
     *   0.66 → #818cf8 indigo (tenor/alto)
     *   1.00 → #00f1fe cyan (soprano)
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
