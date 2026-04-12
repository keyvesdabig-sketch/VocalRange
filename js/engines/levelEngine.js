/**
 * levelEngine.js — Signal Level Meter  (Phase 1)
 *
 * Horizontal RMS bar with peak hold and Vocal Luminescence gradient.
 * Designed for an 8px-tall <canvas> inside a .level-track container
 * (CSS provides border-radius + overflow:hidden — no roundRect needed here).
 *
 * API:
 *   new LevelEngine(canvasElement)
 *   .frame(rms)   — call each RAF frame with current RMS value [0–1]
 *   .reset()      — clear level + peak hold (call on recording start)
 */
export class LevelEngine {

    // ── Private fields ────────────────────────────────────────────
    #canvas;
    #ctx;
    #dpr = window.devicePixelRatio || 1;

    // Physical canvas dimensions (initialised lazily on first visible frame)
    #w = 0;
    #h = 0;
    #logicalW = 0; // used to detect resize

    // Smoothed level (0–1)
    #level = 0;

    // Peak hold
    #peak      = 0;
    #peakHold  = 0; // countdown in frames

    // Pre-built gradient — rebuilt whenever canvas resizes
    #gradient = null;

    // ── Tuning ────────────────────────────────────────────────────
    static ATTACK      = 0.30;  // EMA coefficient on rise (fast attack)
    static RELEASE     = 0.07;  // EMA coefficient on fall (smooth release)
    static HOLD_FRAMES = 90;    // peak hold duration ~1.5 s at 60 fps
    static FALL_RATE   = 0.006; // peak fall per frame (fraction of full width)

    // ── Constructor ───────────────────────────────────────────────
    constructor(canvas) {
        this.#canvas = canvas;
        this.#ctx    = canvas.getContext('2d');
    }

    // ── Public API ────────────────────────────────────────────────

    /**
     * Call every RAF frame with the current RMS amplitude.
     * @param {number} rms  Linear amplitude 0–1 (same value used by studio.js gate)
     */
    frame(rms) {
        // Lazy init / resize detection — canvas must be visible & sized
        const rect = this.#canvas.getBoundingClientRect();
        if (rect.width === 0) return; // still hidden or not mounted

        if (rect.width !== this.#logicalW) {
            this.#logicalW      = rect.width;
            this.#w             = Math.round(rect.width  * this.#dpr);
            this.#h             = Math.round(rect.height * this.#dpr);
            this.#canvas.width  = this.#w;
            this.#canvas.height = this.#h;
            this.#buildGradient();
        }

        // RMS → dBFS → normalised fill fraction (0 = silence, 1 = 0 dBFS)
        const dBFS   = 20 * Math.log10(Math.max(rms, 1e-6));
        const target = Math.max(0, Math.min(1, (dBFS + 60) / 60));

        // EMA: fast attack, slower release
        const alpha   = target > this.#level ? LevelEngine.ATTACK : LevelEngine.RELEASE;
        this.#level  += alpha * (target - this.#level);

        // Peak hold logic
        if (this.#level >= this.#peak) {
            this.#peak     = this.#level;
            this.#peakHold = LevelEngine.HOLD_FRAMES;
        } else if (this.#peakHold > 0) {
            this.#peakHold--;
        } else {
            this.#peak = Math.max(0, this.#peak - LevelEngine.FALL_RATE);
        }

        this.#draw();
    }

    /** Clear level + peak hold — call when a new recording session starts. */
    reset() {
        this.#level    = 0;
        this.#peak     = 0;
        this.#peakHold = 0;
        if (this.#w && this.#h) {
            this.#ctx.clearRect(0, 0, this.#w, this.#h);
        }
    }

    // ── Private ───────────────────────────────────────────────────

    /**
     * Build the Vocal Luminescence gradient.
     * Zones (approximate dBFS positions):
     *   0.00–0.45 → -60 to -33 dBFS — deep purple (sub-threshold)
     *   0.45–0.70 → -33 to -18 dBFS — electric violet (mid)
     *   0.70–0.85 → -18 to  -9 dBFS — cyan glow (healthy)
     *   0.85–0.93 →  -9 to  -4 dBFS — orange (approaching clip)
     *   0.93–1.00 →  -4 to   0 dBFS — red (clip)
     */
    #buildGradient() {
        const g = this.#ctx.createLinearGradient(0, 0, this.#w, 0);
        g.addColorStop(0.00, '#18004c'); // on-primary-fixed: deep purple
        g.addColorStop(0.45, '#6040c0'); // mid violet transition
        g.addColorStop(0.70, '#b6a0ff'); // primary: electric violet
        g.addColorStop(0.85, '#00f1fe'); // secondary: cyan glow
        g.addColorStop(0.93, '#ffaa44'); // orange warning
        g.addColorStop(1.00, '#ff6b8a'); // error: red clip
        this.#gradient = g;
    }

    #draw() {
        const ctx = this.#ctx;
        const w   = this.#w;
        const h   = this.#h;

        // Clear — container CSS (overflow:hidden + border-radius) clips corners
        ctx.clearRect(0, 0, w, h);

        // Fill bar
        const fillW = Math.max(0, this.#level * w);
        if (fillW > 0.5) {
            ctx.fillStyle = this.#gradient;
            ctx.fillRect(0, 0, fillW, h);
        }

        // Peak hold indicator — 2px bright vertical line with violet glow
        if (this.#peak > 0.02) {
            const px  = Math.round(this.#peak * w);
            const pw  = Math.max(2, Math.ceil(2 * this.#dpr));
            const x   = Math.min(px - Math.floor(pw / 2), w - pw);

            ctx.shadowColor = 'rgba(182, 160, 255, 0.95)';
            ctx.shadowBlur  = 4 * this.#dpr;
            ctx.fillStyle   = 'rgba(255, 255, 255, 0.92)';
            ctx.fillRect(x, 0, pw, h);
            ctx.shadowBlur  = 0;
        }
    }
}
