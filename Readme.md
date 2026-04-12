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
├── style.css                — Vocal Luminescence design system
├── manifest.json            — PWA manifest
├── favicon.svg              — Signal Wave icon
├── sw.js                    — Service Worker (offline cache v4)
├── pitchEngine.js           — Pitch detection + SATB classification (ES module)
└── js/
    ├── app.js               — SPA router (hash-based, tab navigation)
    ├── engines/
    │   ├── levelEngine.js       — RMS signal-level meter (Canvas)
    │   └── pitchTrailEngine.js  — Scrolling pitch-history trail (Canvas)
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

Horizontal RMS peak-hold meter with Vocal Luminescence gradient.

```js
const engine = new LevelEngine(canvasElement);
engine.frame(rmsValue);   // call each animation frame
engine.reset();            // call on recording start
```

### `pitchTrailEngine.js` — Scrolling Pitch History

Circular-buffer trail with C-note grid, register-coloured line, and challenge mode support.

```js
const trail = new PitchTrailEngine(canvasElement, {
    pitchMin: 36,   // MIDI C2
    pitchMax: 84,   // MIDI C6
});
trail.frame(midiNote);      // NaN = silence gap
trail.setTarget(60);        // C4 as challenge target (Arena mode)
trail.reset();
const { isHit, semitones } = trail.getAccuracy();
```

See [`AudioVisual`](AudioVisual) for full engine documentation.

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
  → PitchTrailEngine.frame(medianMidi)
```

- **RMS gate:** Silence / room noise (< 0.015) is ignored — no pitch, no trail dot
- **YIN:** More octave-error resistant than autocorrelation (THRESHOLD = 0.12)
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

## Design system — Vocal Luminescence

See [`Design.md`](Design.md) for the full design system specification.

**Quick reference:**
- **Base:** `#160625` Deep Midnight Purple
- **Primary:** `#b6a0ff` Electric Violet
- **Secondary:** `#00f1fe` Cyan Glow
- **Tertiary:** `#ffe792` Gold (prestige only)
- **Typography:** Space Grotesk (display) · Manrope (body)
- **Pitch bar:** MIDI 36 (C2) – 84 (C6), 48 semitones, Deep Violet → Electric Violet → Cyan
- **Piano overlay:** Decorative key markers both sides of bar

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
| 4 | Pitch Trail Engine (PitchTrailEngine) | ✅ Done |
| 5 | Universal SATB Voice Classification | ✅ Done |
| 6 | Full SATB Pitch Range C2–C6 (48 ST) | ✅ Done |
| 7 | UI Polish — Vocal Luminescence | ✅ Done |
| 8 | Arena: Target Note Challenges | 🔲 Next |
| 9 | Progress History (sparkline, last N runs) | 🔲 Planned |
| 10 | Achievement System (unlockable badges) | 🔲 Planned |
