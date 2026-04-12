/**
 * pitchTrailEngine.js — Scrolling Pitch History Trail  (Phase 2)
 *
 * Renders a real-time scrolling pitch trail on a <canvas>.
 * Supports Challenge Mode: set a target note to visualize accuracy.
 *
 * API:
 *   new PitchTrailEngine(canvas, { pitchMin, pitchMax })
 *   .frame(midiNote)       — call each RAF frame; NaN = silence (gap in trail)
 *   .setTarget(midi|null)  — set / clear challenge target note
 *   .getAccuracy()         — { semitones, isHit } — only when target is set
 *   .reset()               — clear trail buffer
 */

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function midiToNoteName(midi) {
    const octave = Math.floor(midi / 12) - 1;
    return NOTE_NAMES[midi % 12] + octave;
}

export class PitchTrailEngine {

    // ── Private fields ────────────────────────────────────────────
    #canvas;
    #ctx;
    #dpr = window.devicePixelRatio || 1;

    // Physical canvas pixel dimensions (lazy-init on first visible frame)
    #w = 0;
    #h = 0;
    #logicalW = 0;

    // Circular pitch buffer: one slot per physical pixel column
    #buffer = null;
    #cursor = 0;         // write head (oldest after wrap)
    #scrollPx = 2;       // physical px written per frame (= 2 logical px * dpr)

    // Current frame pitch (used for accuracy + dot rendering)
    #currentMidi = NaN;

    // Challenge target (optional)
    #targetMidi = null;
    static TOLERANCE_ST = 1.0; // ±1 semitone = "hit" zone

    // MIDI range config
    #pitchMin;
    #pitchMax;
    #pitchRange;

    // ── Constructor ───────────────────────────────────────────────
    constructor(canvas, { pitchMin = 33, pitchMax = 79 } = {}) {
        this.#canvas    = canvas;
        this.#ctx       = canvas.getContext('2d');
        this.#pitchMin  = pitchMin;
        this.#pitchMax  = pitchMax;
        this.#pitchRange = pitchMax - pitchMin;
    }

    // ── Public API ────────────────────────────────────────────────

    /**
     * Feed the engine with the current median-filtered MIDI pitch.
     * Call once per requestAnimationFrame in the main recording loop.
     * @param {number} midiNote  Detected MIDI note, or NaN for silence/gap.
     */
    frame(midiNote) {
        // Lazy init + resize detection
        const rect = this.#canvas.getBoundingClientRect();
        if (rect.width === 0) return; // not mounted / hidden

        if (rect.width !== this.#logicalW) {
            this.#logicalW  = rect.width;
            this.#w         = Math.round(rect.width  * this.#dpr);
            this.#h         = Math.round(rect.height * this.#dpr);
            this.#canvas.width  = this.#w;
            this.#canvas.height = this.#h;
            this.#scrollPx  = Math.max(1, Math.round(2 * this.#dpr));
            // (Re)allocate circular buffer — fill with NaN (silence)
            this.#buffer = new Float32Array(this.#w).fill(NaN);
            this.#cursor = 0;
        }

        this.#currentMidi = midiNote;

        // Advance buffer: write scrollPx slots with the current pitch
        for (let i = 0; i < this.#scrollPx; i++) {
            this.#buffer[this.#cursor] = midiNote;
            this.#cursor = (this.#cursor + 1) % this.#w;
        }

        this.#draw();
    }

    /**
     * Set (or clear) the Challenge target note.
     * When set, the target is drawn as a glowing gold dashed line with a
     * ±TOLERANCE_ST tolerance zone. The trail turns gold when on target.
     * @param {number|null} midiNote
     */
    setTarget(midiNote) {
        this.#targetMidi = midiNote;
    }

    /**
     * Returns accuracy information against the current target note.
     * Returns null when no target is set or pitch is not detected.
     * @returns {{ semitones: number, isHit: boolean } | null}
     */
    getAccuracy() {
        if (this.#targetMidi === null || !isFinite(this.#currentMidi)) return null;
        const diff      = this.#currentMidi - this.#targetMidi;
        const semitones = diff; // fractional
        const isHit     = Math.abs(diff) <= PitchTrailEngine.TOLERANCE_ST;
        return { semitones, isHit };
    }

    /** Clear the pitch buffer and reset head. */
    reset() {
        this.#currentMidi = NaN;
        this.#buffer?.fill(NaN);
        this.#cursor = 0;
        if (this.#w && this.#h) {
            this.#ctx.clearRect(0, 0, this.#w, this.#h);
            // Redraw empty grid so it doesn't go blank
            this.#drawGrid();
        }
    }

    // ── Private rendering ─────────────────────────────────────────

    #draw() {
        const ctx = this.#ctx;
        ctx.clearRect(0, 0, this.#w, this.#h);
        this.#drawGrid();
        if (this.#targetMidi !== null) this.#drawTarget();
        this.#drawTrail();
        if (isFinite(this.#currentMidi)) this.#drawCurrentDot();
    }

    /** Grid: dashed horizontal lines at C2, C3, C4, C5 with note labels. */
    #drawGrid() {
        const ctx = this.#ctx;
        const w   = this.#w;
        const dpr = this.#dpr;

        const gridNotes = [
            { midi: 36, label: 'C2' },
            { midi: 48, label: 'C3' },
            { midi: 60, label: 'C4' },
            { midi: 72, label: 'C5' },
        ].filter(n => n.midi > this.#pitchMin && n.midi < this.#pitchMax);

        ctx.save();
        ctx.strokeStyle  = 'rgba(182, 160, 255, 0.10)';
        ctx.lineWidth    = dpr;
        ctx.setLineDash  ([4 * dpr, 6 * dpr]);
        ctx.fillStyle    = 'rgba(182, 160, 255, 0.28)';
        ctx.font         = `600 ${Math.round(8 * dpr)}px Manrope, sans-serif`;
        ctx.textBaseline = 'middle';

        for (const { midi, label } of gridNotes) {
            const y = Math.round(this.#midiToY(midi));

            ctx.textAlign = 'left';
            ctx.fillText(label, 4 * dpr, y);

            ctx.beginPath();
            ctx.moveTo(24 * dpr, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        ctx.setLineDash([]);
        ctx.restore();
    }

    /**
     * Target line: glowing dashed gold line + ±1 ST tolerance zone + note label.
     * This is the visual centrepiece of Challenge Mode.
     */
    #drawTarget() {
        const ctx  = this.#ctx;
        const w    = this.#w;
        const dpr  = this.#dpr;
        const midi = this.#targetMidi;
        const y    = Math.round(this.#midiToY(midi));
        const yTop = Math.round(this.#midiToY(midi + PitchTrailEngine.TOLERANCE_ST));
        const yBot = Math.round(this.#midiToY(midi - PitchTrailEngine.TOLERANCE_ST));

        ctx.save();

        // Tolerance zone (subtle gold fill)
        ctx.fillStyle = 'rgba(255, 231, 146, 0.07)';
        ctx.fillRect(0, yTop, w, yBot - yTop);

        // Dashed target line with glow
        ctx.strokeStyle = 'rgba(255, 231, 146, 0.85)';
        ctx.lineWidth   = 1.5 * dpr;
        ctx.shadowColor = 'rgba(255, 231, 146, 0.65)';
        ctx.shadowBlur  = 8 * dpr;
        ctx.setLineDash ([6 * dpr, 5 * dpr]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Note label (right-aligned, above line)
        ctx.shadowBlur   = 0;
        ctx.fillStyle    = 'rgba(255, 231, 146, 0.95)';
        ctx.font         = `700 ${Math.round(9 * dpr)}px Manrope, sans-serif`;
        ctx.textAlign    = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(midiToNoteName(Math.round(midi)), w - 5 * dpr, y - 8 * dpr);

        ctx.restore();
    }

    /**
     * Trail: traverse the circular buffer oldest→newest, draw segmented paths.
     * - Silence (NaN) = gap (ctx.moveTo instead of lineTo)
     * - Color: register-based (purple/violet/cyan) with fade for older data
     * - When target is set and pitch is within tolerance: trail turns gold
     */
    #drawTrail() {
        const ctx    = this.#ctx;
        const buf    = this.#buffer;
        const bufLen = this.#w; // 1 slot = 1 physical pixel column
        const dpr    = this.#dpr;

        if (!buf || bufLen === 0) return;

        ctx.save();
        ctx.lineWidth = 2.5 * dpr;
        ctx.lineCap   = 'round';
        ctx.lineJoin  = 'round';

        let pathOpen  = false;
        let lastColor = '';

        for (let i = 0; i < bufLen; i++) {
            const bufIdx = (this.#cursor + i) % bufLen;
            const midi   = buf[bufIdx];

            if (!isFinite(midi)) {
                // Silence gap: commit any open path
                if (pathOpen) { ctx.stroke(); pathOpen = false; }
                continue;
            }

            const x     = i; // physical pixel position (0 = oldest = leftmost)
            const y     = this.#midiToY(midi);
            const age   = i / bufLen; // 0 = oldest, 1 = newest
            const color = this.#trailColor(midi, age);

            if (!pathOpen || color !== lastColor) {
                if (pathOpen) ctx.stroke();
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur  = 4 * dpr;
                ctx.moveTo(x, y);
                pathOpen  = true;
                lastColor = color;
            } else {
                ctx.lineTo(x, y);
            }
        }

        if (pathOpen) ctx.stroke();
        ctx.restore();
    }

    /**
     * Current pitch dot: glowing circle at the right edge.
     * Turns gold when hitting the challenge target.
     */
    #drawCurrentDot() {
        const ctx   = this.#ctx;
        const dpr   = this.#dpr;
        const x     = this.#w - this.#scrollPx;
        const y     = this.#midiToY(this.#currentMidi);
        const isHit = this.getAccuracy()?.isHit ?? false;

        const color  = isHit ? '#ffe792' : '#b6a0ff'; // gold on hit, violet otherwise
        const radius = 5 * dpr;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.shadowColor = color;
        ctx.shadowBlur  = 12 * dpr;
        ctx.fillStyle   = color;
        ctx.fill();
        // Inner bright core
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fill();
        ctx.restore();
    }

    /**
     * Trail segment color.
     * @param {number} midi     MIDI note of this segment
     * @param {number} age      0.0 = oldest, 1.0 = newest
     */
    #trailColor(midi, age) {
        // Alpha fades from 0.18 (oldest) to 0.95 (newest)
        const alpha = (0.18 + age * 0.77).toFixed(2);

        // Challenge mode: gold when within tolerance of target
        if (this.#targetMidi !== null) {
            if (Math.abs(midi - this.#targetMidi) <= PitchTrailEngine.TOLERANCE_ST) {
                return `rgba(255, 231, 146, ${alpha})`;
            }
        }

        // Free mode / off-target: color by vocal register
        if (midi < 52) return `rgba(150, 80, 255,  ${alpha})`; // bass: warm purple
        if (midi < 68) return `rgba(182, 160, 255, ${alpha})`; // mid: electric violet
        return              `rgba(0,   241, 254,  ${alpha})`; // high: cyan
    }

    /** Convert MIDI note → physical Y coordinate. High notes at top, low at bottom. */
    #midiToY(midi) {
        const clamped = Math.max(this.#pitchMin, Math.min(this.#pitchMax, midi));
        return (1 - (clamped - this.#pitchMin) / this.#pitchRange) * this.#h;
    }
}
