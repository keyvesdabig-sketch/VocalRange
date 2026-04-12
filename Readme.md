# VoiceCrack – Vocal Range Analyzer

> **Status:** Active Development  
> A standalone Progressive Web App — no backend, no framework, no build step.

---

## What it does

VoiceCrack detects your vocal range in seconds. Sing your lowest and highest notes into your microphone, and the app tells you your voice type (Bass, Baritone, Tenor, or Countertenor) along with a gamified range score.

---

## How to use it

1. Open `index.html` in a browser (or serve locally — see below)
2. Click **Start Recording** and allow microphone access
3. Sing your **lowest** note — hold it for at least 1 second
4. Sing your **highest** note — hold it for at least 1 second
5. Click **Analyze Voice**

---

## Tech stack

| File | Purpose |
|---|---|
| `index.html` | Entire UI + audio pipeline |
| `pitchEngine.js` | Pure pitch-detection logic (ES module) |
| `sw.js` | Service Worker for offline/PWA support |
| `manifest.json` | PWA manifest |
| `favicon.svg` | Signal Wave app icon |

**Zero dependencies.** No npm, no bundler, no framework.

---

## The pitch engine (`pitchEngine.js`)

The engine is a self-contained ES module with no imports. It can be dropped into any JS/TS project.

**Exports:**

| Function | Description |
|---|---|
| `noteFromPitch(freq)` | Hz → MIDI note number |
| `noteNameFromPitch(note)` | MIDI → human-readable string (e.g. `"C4"`) |
| `yin(buf, sampleRate)` | YIN pitch detection — returns Hz or `-1` |
| `createMedianFilter(size?)` | Stateful median smoother factory |
| `getVoiceSuggestion(min, max)` | Returns `{ type, description, badge }` |
| `getRangeScore(min, max)` | Returns `{ semitones, tier, color }` |

See [`PitchEngineParams.md`](PitchEngineParams.md) for full parameter documentation.

---

## Signal processing pipeline

```
Microphone → Highpass (40 Hz) → Lowpass (1200 Hz) → AnalyserNode
    → RMS gate (threshold 0.015)
    → YIN algorithm (fftSize 4096)
    → 9-frame median filter
    → EMA smoothing (dot glide + Hz display)
    → Adaptive hysteresis (30–75 frames hold time)
```

- **RMS gate:** Silence / room noise (< 0.015) is ignored
- **YIN:** Substantially more resistant to octave errors than autocorrelation
- **Adaptive hold time:** 0.5 s for low notes (A1), 1.25 s for high notes (G5)

---

## Design system — Signal Dark

- **Colors:** `#07080d` base · `#00e5ff` cyan · `#00ffa3` mint · `#6366f1` indigo
- **Typography:** Space Grotesk (display) · Inter (body)
- **Pitch bar:** MIDI 33 (A1) – 79 (G5), 46 semitones, Indigo → Cyan → Mint gradient
- **Visual piano overlay:** Decorative key markers on both sides of the bar

---

## Running locally

```bash
npx serve .
# or
python -m http.server 8090
```

> ⚠️ Must be served over HTTP/HTTPS — microphone access requires a secure context. Opening `index.html` directly via `file://` will not work.

---

## Range score tiers

| Semitones | Tier | Color |
|---|---|---|
| < 6 | Warm Up | Grey |
| 6–9 | Solid | Blue |
| 10–13 | Good | Green |
| 14–17 | Strong | Violet |
| 18–23 | Pro | Gold |
| ≥ 24 | Legend | Pink |

Personal best is persisted in `localStorage` (`vc_best_st`).

---

## Roadmap

| Phase | Feature | Status |
|---|---|---|
| 1 | Range Score + Tier System | ✅ Done |
| 2 | Progress history (last 5 runs, sparkline) | 🔲 Planned |
| 3 | Achievement system (unlockable badges) | 🔲 Planned |
| 4 | Target note challenge (training mode) | 🔲 Planned |
