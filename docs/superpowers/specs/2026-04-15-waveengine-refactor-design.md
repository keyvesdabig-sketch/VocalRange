# WaveEngine Refactor — Design Spec

**Date:** 2026-04-15
**Scope:** `js/engines/waveEngine.js`, `js/engines/pitchTrailEngine.js`, `js/pages/studio.js`
**Goal:** Remove dead code, eliminate duplicated Y-coordinate logic, simplify `frame()` API.

---

## Changes

### 1. Delete `pitchTrailEngine.js`
`js/engines/pitchTrailEngine.js` is dead code — superseded by `WaveEngine`, not imported anywhere.
**Action:** Delete the file. No other files reference it.

### 2. Simplify `frame(midi, rms)`
**Before:** `frame(smoothedMidi, rms, trailMidi = NaN)`
**After:** `frame(midi, rms)`

Since the last refactor, trail and bar consume the same value (`displayMidi ?? NaN`). The third parameter is redundant.

- Remove `trailMidi` parameter and its usage inside `frame()`
- Trail accumulation: use `midi` directly (same value as before)
- Update call site in `studio.js`: `waveEngine.frame(displayMidi ?? NaN, rms)`
- Rename `smoothedMidi` → `midi` for clarity

### 3. Extract `#midiToY(midi, padV, innerH)`
The formula `padV + innerH - clamp(yn) * innerH` appears inline in three draw methods.

**New helper:**
```js
#midiToY(midi, padV, innerH) {
    return padV + innerH * (1 - Math.max(0, Math.min(1,
        (midi - this.#pitchMin) / this.#pitchRange)));
}
```

Replace inline calculations in:
- `#drawGrid` — per C-octave line Y
- `#drawTrail` — per trail point Y
- `#drawPitchBar` — per C-octave tick Y

Rounding (`Math.round`) stays at each call site where it was already applied.

### 4. Update API comments
- File header: remove `trailMidi` from API table
- `frame()` JSDoc: update parameter list
- Internal comments referencing `trailMidi`

---

## Non-Changes
- `this.#midi` EMA inside `frame()` is kept — drives colour smoothing
- All draw method signatures unchanged (no geometry bundle)
- No behaviour changes; pure code reduction
