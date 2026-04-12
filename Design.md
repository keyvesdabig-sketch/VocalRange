# VoiceCrack – Design System: Vocal Luminescence

> Version: 2.2 · Last updated: 2026-04-12

The "Vocal Luminescence" system treats the interface as a **glowing stage**. Everything lives in deep space-violet darkness. Colour only exists where meaning lives — pitch, data, and action. There are no hard lines; tonal stacking and glow replace borders.

---

## Color Palette

```css
:root {
    /* ── Core ─────────────────────────────── */
    --bg:         #160625;   /* Deep Midnight Purple — the stage */
    --primary:    #b6a0ff;   /* Electric Violet — focal colour */
    --secondary:  #00f1fe;   /* Cyan Glow — high notes, actions */
    --tertiary:   #ffe792;   /* Gold — prestige / challenge hit only */
    --red:        #ff6b8a;   /* Error · Low marker · REC dot */
    --on-surface: #f3deff;   /* Violet-tinted white */

    /* ── Text ────────────────────────────── */
    --text-hi:  #f3deff;     /* Headings, values */
    --text-mid: #9b85c4;     /* Body, labels */
    --text-lo:  #4a3570;     /* Decorative / barely-there */
}
```

### Usage Rules

| Token | Where used |
|---|---|
| `--bg` | Page background only |
| `--primary` | Headings, active nav, pitch dot, primary buttons |
| `--secondary` | Highest note marker, Hz display, C4 reference label |
| `--tertiary` | Challenge hit state (gold trail), record badge — **never decorative** |
| `--red` | Lowest note marker, error states, REC indicator |
| `--text-lo` | Background-level decorative text only |

---

## Surface Stack

Three tonal layers — no hard borders, stacking only.

```
Layer 0 — Background:  #160625  (page base)
Layer 1 — The Stage:   rgba(30, 8, 55, 0.50)   --surf-card   ← main card
Layer 2 — Component:   rgba(58, 20, 90, 0.60)  --surf-comp   ← result box
Layer 3 — Recess:      rgba(0,  0,  0,  0.40)  --surf-recess ← inputs, trail canvas
```

Glassmorphism parameters per layer:
- **Card:** `backdrop-filter: blur(28px)` · `box-shadow: 0 40px 100px rgba(24,0,76,0.55)`
- **Result box:** `backdrop-filter: blur(40px)`
- **No explicit borders** — use `box-shadow: 0 0 0 1px rgba(182,160,255,0.08) inset` instead

---

## Typography

| Role | Font | Size | Weight |
|---|---|---|---|
| App name / large headings | Space Grotesk | 30–34px | 700 |
| Voice type result | Space Grotesk | 34px | 700 |
| Score number | Space Grotesk | 40px | 700 |
| Section labels | Manrope | 9px | 700 · UPPERCASE · 0.1em tracking |
| Body / instruction text | Manrope | 13px | 400 |
| Hz / note display | Manrope | 12–22px | 700 · tabular-nums |
| Button | Space Grotesk | 13px | 700 · UPPERCASE · 0.07em tracking |

**Gradient text** (headings, voice type):
```css
background: linear-gradient(135deg, var(--primary), var(--secondary));
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

---

## Component Patterns

### Glassmorphism Card (`.mainCard`)
```css
background: var(--surf-card);
backdrop-filter: blur(28px);
border-radius: var(--radius);          /* 2rem = 32px */
box-shadow:
    0 0 0 1px rgba(182,160,255,0.08) inset,
    0 40px 100px rgba(24,0,76,0.55),
    0 0 60px rgba(182,160,255,0.04);
```

### Pill Buttons
- **Primary:** `background: linear-gradient(135deg, #b6a0ff, #8b6fe8)` · dark text `#0a0020`  
  Idle state: `animation: btn-idle 3s ease-in-out infinite` (soft glow pulse)
- **Ghost:** `background: rgba(0,241,254,0.05)` · `box-shadow: 0 0 0 1px rgba(0,241,254,0.2) inset`
- Both: `border-radius: 9999px`

### Mini Cards (measure-card, stub-features li)
```css
background: var(--surf-recess);
border-radius: var(--radius-xs);   /* 0.75rem = 12px */
box-shadow: inset 0 0 20px rgba(182,160,255,0.04);
```

### Pitch Bar — C2 to C6
```css
background: linear-gradient(to top,
    #18004c  0%,     /* Deep violet — bass register */
    #b6a0ff 55%,     /* Electric Violet — midrange */
    #00f1fe 100%     /* Cyan Glow — treble / soprano */
);
```
- Note labels: `rgba(182, 160, 255, 0.38)` — C4 labelled in cyan `rgba(0,241,254,0.65)` with glow
- Min marker: `--red` · Max marker: `--secondary`

### Trail Canvas (PitchTrailEngine)
- Background: `rgba(10, 5, 25, 0.88)` — very dark violet-tinted
- CSS static grid visible in idle state (C3/C4/C5 reference lines via `linear-gradient`)
- Left-edge fade via `::after` pseudo-element (oldest trail data fades out)
- Trail line colour is register-dependent (bass=violet, mid=primary, treble=cyan)

### Level Meter (LevelEngine)
- 8px pill-shaped track, `border-radius: 999px`
- Gradient fill: `#6b3fa0` → `#b6a0ff` → `#00f1fe`
- Peak-hold marker: thin white bar that decays slowly

### REC Indicator
```css
background: rgba(255, 107, 138, 0.07);
box-shadow: 0 0 0 1px rgba(255,107,138,0.15) inset;
```
- Dot: `animation: rec-pulse 1.1s ease-in-out infinite` (scale + opacity)

---

## Shape & Radius Tokens

| Token | Value | Used for |
|---|---|---|
| `--radius` | `2rem` (32px) | Main card corners |
| `--radius-sm` | `1.5rem` (24px) | Result box |
| `--radius-xs` | `0.75rem` (12px) | Mini cards, trail canvas, level bar container |
| `999px` | — | Pill buttons, badge pills, level track |

---

## Motion & Animation Principles

1. **Page entrance:** `page-in` — 0.22s ease-out, 8px translateY
2. **Button shimmer (idle):** `btn-idle` — 3s ease-in-out infinite, glow box-shadow pulse
3. **REC dot:** `rec-pulse` — 1.1s ease-in-out infinite, scale 1 → 0.65
4. **Pitch dot:** EMA glide (α = 0.08), transition `opacity 0.2s`
5. **Markers / overlays:** `transition: bottom/height 0.15s–0.35s ease-out`
6. **Result box entrance:** `fade-up` — 0.3s ease-out, 7px translateY
7. **Record badge:** `record-pulse` — 0.45s ease-in-out × 5

**Rule:** Animations are functional or celebratory — never decorative noise.

---

## Layout

### Desktop (> 620px)
- Two-column grid: `220px 1fr` — left = pitch meter, right = controls
- Card `max-width: 880px`, centered with `#app` flex

### Mobile (≤ 620px)
- Single column — pitch column becomes horizontal strip (140px tall)
- Piano keys still visible; pitch bar horizontal-ish
- Controls stack vertically below

### Bottom Navigation
- Fixed `72px` bar, `border-radius: 2rem 2rem 0 0`
- Glass: `backdrop-filter: blur(24px)` · subtle top border shadow
- Active tab: `--primary` colour + `drop-shadow(0 0 6px rgba(182,160,255,0.65))` on icon

---

## Background Blobs

```html
<div class="bg-blob bg-blob--violet"></div>  <!-- top-left radial -->
<div class="bg-blob bg-blob--cyan"></div>    <!-- bottom-right radial -->
<div class="bg-blob bg-blob--deep"></div>    <!-- soft centre glow -->
```
Static — never animated. Provides depth without distraction.

---

## Design Do's and Don'ts

| ✅ Do | ❌ Don't |
|---|---|
| Use tonal stacking for depth | Use explicit borders or dividers |
| Use glow (`box-shadow`, `text-shadow`) for emphasis | Use hard contrasting backgrounds |
| Use `--tertiary` (gold) sparingly for achievement only | Use gold as a generic accent |
| Use gradient text for major headings | Use gradient text on body copy |
| Keep animation < 0.4s for transitions | Add animations that don't convey meaning |
