# WaveEngine Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead `pitchTrailEngine.js`, simplify `frame()` API, and extract a `#midiToY` helper to eliminate three duplicated Y-coordinate calculations in `waveEngine.js`.

**Architecture:** Pure refactor — no behaviour changes. Three independent edits that each leave the codebase in a working state. No new files; one file deleted, two modified.

**Tech Stack:** Vanilla JS ES modules, Canvas 2D API, no build step.

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| Delete | `js/engines/pitchTrailEngine.js` | Entire file removed |
| Modify | `js/engines/waveEngine.js` | `frame()` signature, `#midiToY` helper, call sites, comments |
| Modify | `js/pages/studio.js` | One `waveEngine.frame(...)` call — drop third argument |

---

### Task 1: Delete dead code — `pitchTrailEngine.js`

**Files:**
- Delete: `js/engines/pitchTrailEngine.js`

- [ ] **Step 1: Verify no imports exist**

Run in project root:
```bash
grep -r "pitchTrailEngine" js/ index.html
```
Expected output: no matches (file is already unused).

- [ ] **Step 2: Delete the file**

```bash
git rm js/engines/pitchTrailEngine.js
```

- [ ] **Step 3: Verify app still loads**

Open `http://localhost:3000` in the browser. Studio page must load without console errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: remove dead pitchTrailEngine (superseded by WaveEngine)"
```

---

### Task 2: Simplify `frame()` — drop redundant `trailMidi` parameter

**Files:**
- Modify: `js/engines/waveEngine.js`
- Modify: `js/pages/studio.js`

The third parameter `trailMidi` was made redundant when trail and bar were unified to use the same `displayMidi ?? NaN` value. Both `smoothedMidi` and `trailMidi` now carry the same value on every call.

- [ ] **Step 1: Update `frame()` in `waveEngine.js`**

Find (lines ~132–154):
```js
/**
 * Feed values each recording frame.
 * @param {number} smoothedMidi  EMA-smoothed MIDI (colour)
 * @param {number} rms           Raw RMS amplitude
 * @param {number} [trailMidi]   Median-filtered MIDI for trail (or NaN for gap)
 */
frame(smoothedMidi, rms, trailMidi = NaN) {
    const silent = !isFinite(smoothedMidi) || rms < RMS_GATE;
    if (!silent) {
        this.#midi = isFinite(this.#midi)
            ? this.#ema(this.#midi, smoothedMidi, 0.08)
            : smoothedMidi;
    }
    // Accumulate trail only while recording
    if (this.#analyser) {
        const now = performance.now();
        this.#trail.push({ midi: isFinite(trailMidi) ? trailMidi : NaN, t: now });
        const cutoff = now - TRAIL_DURATION;
        let lo = 0, hi = this.#trail.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (this.#trail[mid].t < cutoff) lo = mid + 1; else hi = mid; }
        if (lo > 0) this.#trail.splice(0, lo);
    }
}
```

Replace with:
```js
/**
 * Feed values each recording frame.
 * @param {number} midi  Stability-gated, EMA-smoothed MIDI note (or NaN for silence)
 * @param {number} rms   Raw RMS amplitude
 */
frame(midi, rms) {
    const silent = !isFinite(midi) || rms < RMS_GATE;
    if (!silent) {
        this.#midi = isFinite(this.#midi)
            ? this.#ema(this.#midi, midi, 0.08)
            : midi;
    }
    // Accumulate trail only while recording
    if (this.#analyser) {
        const now = performance.now();
        this.#trail.push({ midi: isFinite(midi) ? midi : NaN, t: now });
        const cutoff = now - TRAIL_DURATION;
        let lo = 0, hi = this.#trail.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (this.#trail[mid].t < cutoff) lo = mid + 1; else hi = mid; }
        if (lo > 0) this.#trail.splice(0, lo);
    }
}
```

- [ ] **Step 2: Update file-header API comment in `waveEngine.js`**

Find:
```js
 *   .frame(smoothedMidi, rms, trailMidi)  — feed each RAF frame
```
Replace with:
```js
 *   .frame(midi, rms)                     — feed each RAF frame
```

- [ ] **Step 3: Update call site in `studio.js`**

Find:
```js
        waveEngine.frame(displayMidi ?? NaN, rms, displayMidi ?? NaN); // trail + EQ: same stable value as bar-dot
```
Replace with:
```js
        waveEngine.frame(displayMidi ?? NaN, rms);
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:3000`. Start recording — trail and pitch-bar dot must appear as before. No console errors.

- [ ] **Step 5: Commit**

```bash
git add js/engines/waveEngine.js js/pages/studio.js
git commit -m "refactor: simplify WaveEngine.frame() — drop redundant trailMidi param"
```

---

### Task 3: Extract `#midiToY(midi, padV, innerH)` helper

**Files:**
- Modify: `js/engines/waveEngine.js`

The formula `padV + innerH - clamp(yn) * innerH` (where `yn = (midi − pitchMin) / pitchRange`) is inlined in three draw methods. Extract it once.

- [ ] **Step 1: Add `#midiToY` after the `#ema` helper**

Find (near end of `waveEngine.js`):
```js
    #ema(current, target, alpha) {
        return isNaN(current) ? target : current + alpha * (target - current);
    }
```
Replace with:
```js
    #ema(current, target, alpha) {
        return isNaN(current) ? target : current + alpha * (target - current);
    }

    /** Convert MIDI note → physical Y coordinate (high notes at top). */
    #midiToY(midi, padV, innerH) {
        const yn = Math.max(0, Math.min(1, (midi - this.#pitchMin) / this.#pitchRange));
        return padV + innerH * (1 - yn);
    }
```

- [ ] **Step 2: Replace inline calculation in `#drawGrid`**

Find:
```js
        for (const { midi } of C_OCTAVES) {
            const yn = (midi - this.#pitchMin) / this.#pitchRange;
            const y  = padV + innerH - Math.round(yn * innerH);
```
Replace with:
```js
        for (const { midi } of C_OCTAVES) {
            const y = Math.round(this.#midiToY(midi, padV, innerH));
```

- [ ] **Step 3: Replace inline calculation in `#drawTrail`**

Find:
```js
            const yn = Math.max(0, Math.min(1, (pt.midi - this.#pitchMin) / this.#pitchRange));
            pts.push({ x: startX + xf * trailW, y: padV + innerH - yn * innerH });
```
Replace with:
```js
            pts.push({ x: startX + xf * trailW, y: this.#midiToY(pt.midi, padV, innerH) });
```

- [ ] **Step 4: Replace inline calculation in `#drawPitchBar`**

Find:
```js
        for (const { midi, label } of C_OCTAVES) {
            const yn = (midi - this.#pitchMin) / this.#pitchRange;
            const y  = Math.round(padV + innerH - yn * innerH);
```
Replace with:
```js
        for (const { midi, label } of C_OCTAVES) {
            const y = Math.round(this.#midiToY(midi, padV, innerH));
```

- [ ] **Step 5: Verify in browser**

Open `http://localhost:3000`. Grid lines, trail, and pitch-bar ticks must be at the same vertical positions as before. Start a recording and confirm no visual regressions.

- [ ] **Step 6: Commit**

```bash
git add js/engines/waveEngine.js
git commit -m "refactor: extract #midiToY helper, remove 3 duplicated Y calculations"
```

---

## Self-Review

**Spec coverage:**
- ✅ Delete `pitchTrailEngine.js` → Task 1
- ✅ Simplify `frame()` signature → Task 2
- ✅ Update `studio.js` call site → Task 2 Step 3
- ✅ Extract `#midiToY` → Task 3
- ✅ Update API comments → Task 2 Steps 1 & 2

**Placeholder scan:** No TBD, no vague steps — all steps include exact before/after code.

**Type consistency:** `#midiToY` defined in Task 3 Step 1, used in Steps 2–4 with identical signature `(midi, padV, innerH)`.
