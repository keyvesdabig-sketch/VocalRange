# VocalRange – Vocal Range Analyzer

> **Status:** Active Development  
> A standalone Progressive Web App — no backend, no framework, no build step.

---

## What it does

VocalRange detects your vocal range in seconds. Sing your lowest and highest notes into your microphone, and the app classifies your voice type across the full **SATB spectrum** (Soprano, Mezzo-Soprano, Alto, Tenor, Baritone, Bass, Full Range) — with a gamified range score and real-time visual feedback.

---

## How to use it

1. Open `index.html` in a browser (or serve locally — see below)
2. Click **Start Recording** and allow microphone access
3. Sing your **lowest** comfortable note — hold it for at least 1 second
4. Sing your **highest** comfortable note — hold it for at least 1 second
5. Click **Analyze Voice**

The **Pitch History trail** visualises your pitch in real time while you sing. The **Signal Level bar** confirms your microphone is working.

---

## Architecture

VocalRange is a vanilla JS SPA without a build step.

```
VocalRange/
├── index.html               — App shell, service worker registration
├── style.css                — Editorial Precision design system
├── manifest.json            — PWA manifest
├── favicon.svg              — Signal Wave icon
├── sw.js                    — Service Worker (offline cache v2)
├── pitchEngine.js           — Pitch detection + SATB classification (ES module)
└── js/
    ├── app.js               — SPA router (hash-based, tab navigation)
    ├── engines/
    │   ├── levelEngine.js       — RMS signal-level meter (Canvas)
    │   ├── waveEngine.js        — Unified EQ + pitch trail + pitch bar (Canvas)
    │   └── avatarEngine.js      — Audio-reactive avatar visualiser (Canvas)
    └── pages/
        ├── studio.js        — Studio page: recording + analysis
        ├── vitals.js        — Vitals page (stub)
        ├── arena.js         — Arena page / Challenges (stub)
        └── profile.js       — Profile page (stub)
```

**Zero external dependencies.** No npm, no bundler, no framework.

---

## The pitch engine (`pitchEngine.js`)

Self-contained ES module — no imports. Drop into any JS/TS project.

| Export | Description |
|---|---|
| `noteFromPitch(freq)` | Hz → MIDI note number |
| `noteNameFromPitch(note)` | MIDI → human-readable string (e.g. `"C4"`) |
| `yin(buf, sampleRate)` | YIN pitch detection — returns Hz or `-1` |
| `createMedianFilter(size?)` | Stateful 9-frame median smoother factory |
| `getVoiceSuggestion(min, max)` | SATB classification — returns `{ type, description, badge }` |
| `getRangeScore(min, max)` | Returns `{ semitones, tier, color }` |

See [`PitchEngineParams.md`](PitchEngineParams.md) for full parameter documentation.

---

## Audio engine modules (`js/engines/`)

### `levelEngine.js` — Signal Level Meter

Horizontal RMS peak-hold meter with Editorial Precision amber→steel gradient.

```js
const engine = new LevelEngine(canvasElement);
engine.frame(rmsValue);   // call each animation frame
engine.reset();            // call on recording start
```

### `waveEngine.js` — Unified Vocal Interface

One canvas, three zones: EQ spectrum bars (left), scrolling pitch trail (centre), pitch reference bar (right). Colour language is unified — amber→champagne→steel gradient driven by MIDI pitch register.

```js
const engine = new WaveEngine(canvasElement, {
    pitchMin: 36,   // MIDI C2
    pitchMax: 84,   // MIDI C6
});
engine.setAnalyser(analyserNode);   // call on recording start
engine.frame(midi, rms);            // call each animation frame; NaN midi = silence
engine.clearAnalyser();             // call on recording stop (trail kept for review)
engine.stop();                      // call on page cleanup (cancels internal RAF)
```

---

## Signal processing pipeline

```
Microphone
  → Highpass filter  (40 Hz)    — removes sub-bass rumble
  → Lowpass filter   (2000 Hz)  — passes full SATB range (C2–C6)
  → AnalyserNode     (fftSize 4096)
  → RMS amplitude gate  (threshold 0.015)
  → YIN algorithm    (9-frame median filter)
  → EMA smoothing    (dot glide α=0.08, Hz display α=0.04)
  → Adaptive hysteresis (30–75 frames hold time)
  → LevelEngine.frame(rms)
  → WaveEngine.frame(midi, rms)
```

- **RMS gate:** Silence / room noise (< 0.015) is ignored — no pitch, no trail dot
- **YIN:** More octave-error resistant than autocorrelation (THRESHOLD = 0.11)
- **Adaptive hold time:** 0.5 s for C2 (low), 1.25 s for C6 (high)

---

## SATB voice classification

Classification is based on the **centre of the measured range** (minPitch + maxPitch) / 2, with the lowest note as secondary discriminator for the Tenor / Alto overlap zone.

| Type | Centre (MIDI) | Typical Range | Badge |
|---|---|---|---|
| Bass | < 53 | E2–E4 | Deep Foundation |
| Baritone | 53–57 | G2–G4 | The Bridge |
| Tenor | 58–64, min ≤ F3 | C3–C5 | Leading Voice |
| Alto | 58–64, min > F3 | G3–E5 | Warm & Deep |
| Mezzo-Soprano | 65–69 | A3–A5 | The Blend |
| Soprano | ≥ 70 | C4–C6 | High Flight |
| Full Range | range ≥ 28 ST, C2→C5+ | — | Full Compass |

---

## Design system — Editorial Precision

See [`Design.md`](Design.md) for the full design system specification.

**Quick reference:**
- **Base:** `#08080A` Near-black warm canvas
- **Champagne:** `#E9E1D3` Structural white · primary CTA
- **Gold:** `#C8965A` Warm amber — low/min note
- **Steel:** `#7AAFC4` Cool steel — high/max note
- **Typography:** Noto Serif (display / data reveals) · Inter (labels / UI)
- **Pitch bar:** MIDI 36 (C2) – 84 (C6), 48 semitones, Deep Amber → Warm Gold → Cool Steel
- **No borders:** Structural separation via tonal surface shifts only

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
| < 6 | Warm Up | Slate |
| 6–9 | Solid | Blue |
| 10–13 | Good | Green |
| 14–17 | Strong | Violet |
| 18–23 | Pro | Gold |
| ≥ 24 | Legend | Rose |

Personal best persisted in `localStorage` (`vc_best_st`).

---

## Roadmap

| Phase | Feature | Status |
|---|---|---|
| 1 | Range Score + Tier System | ✅ Done |
| 2 | SPA Architecture + Tab Navigation | ✅ Done |
| 3 | Signal Level Engine (LevelEngine) | ✅ Done |
| 4 | Unified Vocal Interface (WaveEngine: EQ + trail + pitch bar) | ✅ Done |
| 5 | Universal SATB Voice Classification | ✅ Done |
| 6 | Full SATB Pitch Range C2–C6 (48 ST) | ✅ Done |
| 7 | UI Polish — Vocal Luminescence (v2.2) | ✅ Done |
| 7.1 | Design Redesign — Editorial Precision (v3.0) | ✅ Done |
| 8 | Arena: Target Note Challenges | 🔲 Next |
| 9 | Progress History (sparkline, last N runs) | 🔲 Planned |
| 10 | Achievement System (unlockable badges) | 🔲 Planned |
