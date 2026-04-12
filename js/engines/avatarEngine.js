/**
 * avatarEngine.js — Audio-Reactive Vocal Blob (v2)
 *
 * Visual upgrades over v1:
 *   – Organic blob path (not a perfect ellipse)
 *   – Radial gradient fill with inner highlight + pitch-coloured outer edge
 *   – Eyebrows that raise (high pitch) or furrow (low pitch)
 *   – Cheek blush intensity tied to RMS amplitude
 *   – Sound rings that pulse and expand when singing loudly
 *
 * Scalar mappings (Avatar.md):
 *   RMS    → mouth ry, glow blur, cheek blush, sound ring emission
 *   Pitch  → Y position, gradient colour temperature, brow translate, squash/stretch
 *   Silence → idle pose (float + blink animation via .av-idle class)
 *
 * API:
 *   new AvatarEngine(svgEl, posEl, { pitchMin, pitchMax })
 *   .frame(smoothedMidi, rms)   — once per RAF frame during recording
 *   .reset()                    — reverts to idle pose
 */

const RMS_GATE      = 0.015;  // amplitude gate (same as recording loop)
const RMS_RING_GATE = 0.055;  // threshold for sound ring emission
const PITCH_MIN_D   = 36;     // MIDI C2
const PITCH_MAX_D   = 84;     // MIDI C6

// Radial gradient colour pairs: [bright inner, deep outer]
const GRAD = {
    bass:     ['#c4a0ff', '#1a0050'],
    baritone: ['#d4c0ff', '#2e0880'],
    tenor:    ['#aaaeff', '#101068'],
    soprano:  ['#7affff', '#003858'],
};

// Dress linear gradient: [top, bottom] — slightly darker than face outer
const DRESS_GRAD = {
    bass:     ['#280060', '#0a0020'],
    baritone: ['#3a0888', '#150034'],
    tenor:    ['#181888', '#060630'],
    soprano:  ['#004870', '#001530'],
};

// Ring + glow stroke colour per register
const RING_COLOR = {
    bass:     '#8b5cf6',
    baritone: '#b6a0ff',
    tenor:    '#818cf8',
    soprano:  '#00f1fe',
};

function register(midi) {
    if (midi < 52) return 'bass';
    if (midi < 60) return 'baritone';
    if (midi < 68) return 'tenor';
    return 'soprano';
}

export class AvatarEngine {

    // ── Private fields ────────────────────────────────────────────
    #svg;       // <svg id="voiceAvatar">
    #posEl;     // <div id="avatarPosEl"> — Y positioning wrapper
    #body;      // <path id="avBody">
    #mouth;     // <ellipse id="avMouth">
    #gradIn;    // <stop id="avGradIn">
    #gradOut;   // <stop id="avGradOut">
    #dressTop;  // <stop id="avDressTop">
    #dressBot;  // <stop id="avDressBot">
    #browL;     // <path id="avBrowL">
    #browR;     // <path id="avBrowR">
    #ring1;     // <ellipse id="avRing1">
    #ring2;     // <ellipse id="avRing2">
    #cheekL;    // <ellipse id="avCheekL">
    #cheekR;    // <ellipse id="avCheekR">

    #pitchMin;
    #pitchMax;
    #pitchRange;
    #idle = true;

    constructor(svgEl, posEl, { pitchMin = PITCH_MIN_D, pitchMax = PITCH_MAX_D } = {}) {
        this.#svg       = svgEl;
        this.#posEl     = posEl;
        this.#body      = svgEl.querySelector('#avBody');
        this.#mouth     = svgEl.querySelector('#avMouth');
        this.#gradIn    = svgEl.querySelector('#avGradIn');
        this.#gradOut   = svgEl.querySelector('#avGradOut');
        this.#dressTop  = svgEl.querySelector('#avDressTop');
        this.#dressBot  = svgEl.querySelector('#avDressBot');
        this.#browL     = svgEl.querySelector('#avBrowL');
        this.#browR     = svgEl.querySelector('#avBrowR');
        this.#ring1     = svgEl.querySelector('#avRing1');
        this.#ring2     = svgEl.querySelector('#avRing2');
        this.#cheekL    = svgEl.querySelector('#avCheekL');
        this.#cheekR    = svgEl.querySelector('#avCheekR');
        this.#pitchMin   = pitchMin;
        this.#pitchMax   = pitchMax;
        this.#pitchRange = pitchMax - pitchMin;

        this.#applyIdle();
    }

    /**
     * Update avatar visuals each RAF frame.
     * @param {number} smoothedMidi  EMA-smoothed MIDI note (or NaN for silence)
     * @param {number} rms           Raw RMS amplitude from the recording buffer
     */
    frame(smoothedMidi, rms) {
        const silent = !isFinite(smoothedMidi) || rms < RMS_GATE;

        if (silent) {
            if (!this.#idle) this.#applyIdle();
            return;
        }

        if (this.#idle) this.#exitIdle();

        const norm = Math.max(0, Math.min(1,
            (smoothedMidi - this.#pitchMin) / this.#pitchRange
        ));
        const reg      = register(smoothedMidi);
        const ringCol  = RING_COLOR[reg];

        // ── Y position: pitch → bottom % within #avatarWrap ──────────
        // SVG is 185u tall rendered at ~167px. Wrap is 280px.
        // Range 2%–38% keeps full avatar visible with good travel.
        const yBottom = 2 + norm * 36;
        this.#posEl.style.bottom = yBottom.toFixed(1) + '%';

        // ── Mouth opening: RMS → oval height (ry attr) ────────────────
        const mouthRy = Math.min(15, 3 + Math.max(0, rms - RMS_GATE) * 108);
        this.#mouth.setAttribute('ry', mouthRy.toFixed(1));

        // ── Gradient colour temperature ───────────────────────────────
        const [inner, outer] = GRAD[reg];
        this.#gradIn.setAttribute('stop-color', inner);
        this.#gradOut.setAttribute('stop-color', outer);

        // ── Dress gradient (matches/extends face outer colour) ────────
        const [dressTop, dressBot] = DRESS_GRAD[reg];
        this.#dressTop.setAttribute('stop-color', dressTop);
        this.#dressBot.setAttribute('stop-color', dressBot);

        // ── Outer glow: RMS → filter blur radius ─────────────────────
        const glowBlur = (10 + Math.min(0.18, rms) * 100).toFixed(1);
        this.#svg.style.filter = `drop-shadow(0 0 ${glowBlur}px ${ringCol})`;

        // ── Squash & Stretch: pitch → scaleX / scaleY ────────────────
        // Bass (norm 0): wide + short — scaleX 1.10, scaleY 0.88
        // Soprano (norm 1): narrow + tall — scaleX 0.94, scaleY 1.14
        const scaleY = (0.88 + norm * 0.26).toFixed(3);
        const scaleX = (1.10 - norm * 0.16).toFixed(3);
        this.#svg.style.transform = `scaleX(${scaleX}) scaleY(${scaleY})`;

        // ── Eyebrows: raise on high pitch, furrow on low ──────────────
        // norm 0 (bass) → +4 px down (furrowed)
        // norm 1 (soprano) → -5 px up (raised / surprised)
        const browY = (4 - norm * 9).toFixed(1);
        this.#browL.setAttribute('transform', `translate(0, ${browY})`);
        this.#browR.setAttribute('transform', `translate(0, ${browY})`);

        // ── Cheek blush: intensity scales with RMS ───────────────────
        const blush = Math.min(0.34, 0.06 + Math.max(0, rms - 0.02) * 1.6);
        this.#cheekL.setAttribute('fill-opacity', blush.toFixed(2));
        this.#cheekR.setAttribute('fill-opacity', blush.toFixed(2));

        // ── Sound rings: emit when loud enough ───────────────────────
        const loud = rms > RMS_RING_GATE;
        if (loud) {
            this.#ring1.setAttribute('stroke', ringCol);
            this.#ring2.setAttribute('stroke', ringCol);
        }
        this.#ring1.classList.toggle('av-ring--on', loud);
        this.#ring2.classList.toggle('av-ring--on', loud);
    }

    /** Return avatar to idle rest pose immediately. */
    reset() {
        this.#applyIdle();
    }

    // ── Private ────────────────────────────────────────────────────

    #applyIdle() {
        this.#idle = true;
        this.#posEl.classList.add('av-idle');
        this.#posEl.style.bottom = '';                         // CSS default (24%)
        this.#mouth.setAttribute('ry', '4');
        this.#gradIn.setAttribute('stop-color',   GRAD.baritone[0]);
        this.#gradOut.setAttribute('stop-color',  GRAD.baritone[1]);
        this.#dressTop.setAttribute('stop-color', DRESS_GRAD.baritone[0]);
        this.#dressBot.setAttribute('stop-color', DRESS_GRAD.baritone[1]);
        this.#browL.setAttribute('transform', '');
        this.#browR.setAttribute('transform', '');
        this.#cheekL.setAttribute('fill-opacity', '0.08');
        this.#cheekR.setAttribute('fill-opacity', '0.08');
        this.#ring1.classList.remove('av-ring--on');
        this.#ring2.classList.remove('av-ring--on');
        this.#svg.style.filter    = '';
        this.#svg.style.transform = '';
    }

    #exitIdle() {
        this.#idle = false;
        this.#posEl.classList.remove('av-idle');
    }
}
