# VocalRange – Design System: Editorial Precision

> Version: 3.0 · Last updated: 2026-04-16

"Editorial Precision" treats the interface as a **gallery, not a utility**. Inspired by the "Timeless Curator" ethos of high-end editorial design — architecture of silence, intentional spacing, and typography as the primary visual gesture. Depth is achieved through tonal layering, not borders or glow.

---

## Color Palette

```css
:root {
    /* ── Surface Stack (Tonal Gravity) ───────────────── */
    --surface:                  #08080A;   /* Base canvas — near black, warm */
    --surface-container-high:   #0D0B09;   /* Anchored elements (nav) */
    --surface-container:        #141210;   /* General sections */
    --surface-container-low:    #1C1916;   /* Cards — slight lift */
    --surface-container-lowest: #262119;   /* Most elevated / interactive */
    --surface-recess:           #050503;   /* Deepest inset */

    /* ── Text (Champagne Hierarchy) ──────────────────── */
    --on-surface:     #EDE5D8;   /* Warm champagne — primary */
    --on-surface-mid: #8A8178;   /* Mid emphasis */
    --on-surface-low: #47433C;   /* Low / disabled */
    --on-primary:     #08080A;   /* Text on champagne CTA button */

    /* ── Accent ───────────────────────────────────────── */
    --champagne:  #E9E1D3;   /* Structural warm white / CTA bg */
    --gold:       #C8965A;   /* Low / min note — warm amber */
    --steel:      #7AAFC4;   /* High / max note — cool steel */
    --error:      #B87878;   /* Muted rose error */
}
```

### Token Usage

| Token | Where used |
|---|---|
| `--surface` | Page background only |
| `--surface-container-low` | Main card background |
| `--surface-container` | Range row, result box, measure cards |
| `--surface-container-lowest` | Ghost/secondary buttons, elevated interactive elements |
| `--surface-recess` | Wave canvas background, deepest inset areas |
| `--champagne` | Primary CTA button background, structural white |
| `--on-surface` | All primary text |
| `--on-surface-mid` | Labels, secondary text, default note display |
| `--on-surface-low` | Section labels (UPPERCASE), disabled states |
| `--gold` | Min / low note indicator, record badge |
| `--steel` | Max / high note indicator, C4 reference label |
| `--error` | Error states only |

---

## The "No-Line" Rule

**Explicit instruction:** 1px solid borders are prohibited for structural separation. Boundaries must be communicated through:

1. **Background tonal shifts** — a `--surface-container-low` section on a `--surface` background is sufficient to indicate a new area
2. **Negative space** — generous padding separates ideas without boxing them
3. **Ghost borders** (fallback only) — `box-shadow: 0 0 0 1px rgba(237,229,216,0.05) inset` — felt, not seen

The only explicit `border` in use is the nav top-border at 5% opacity, and the score section divider at 6% opacity — both below the threshold of visual prominence.

---

## Surface Stack

```
Layer 0 — Base:        #08080A   --surface              ← page background
Layer 1 — Anchored:    #0D0B09   --surface-container-high   ← nav backdrop base
Layer 2 — Section:     #141210   --surface-container    ← range row, result box
Layer 3 — Card:        #1C1916   --surface-container-low    ← main card
Layer 4 — Elevated:    #262119   --surface-container-lowest ← buttons, interactive
Layer 5 — Recess:      #050503   --surface-recess       ← wave canvas, inputs
```

No `backdrop-filter` or glassmorphism on content cards — solid tonal backgrounds only. The bottom navigation is the sole glassmorphism element (`backdrop-filter: blur(32px)`).

---

## Typography

| Role | Font | Size | Weight | Notes |
|---|---|---|---|---|
| App name | Noto Serif | 21px | 600 | Header, letter-spacing −0.02em |
| Voice type result | Noto Serif | 48px | 600 | Editorial hero moment |
| Score number | Noto Serif | 48px | 600 | Tabular-nums via font-variant |
| Captured note (range row) | Noto Serif | 24px | 600 | Minimal, authoritative |
| Personal best | Noto Serif | 22px | 600 | |
| Section labels | Inter | 9px | 600 | ALL CAPS · 0.12–0.14em tracking |
| Body / instruction text | Inter | 12px | 400 | Italic in idle/hint state |
| Hz display | Inter | 24px | 300 | Tabular-nums · 0.04em tracking |
| Button | Inter | 11px | 600 | ALL CAPS · 0.1em tracking |

**No gradient text.** All text uses solid `--champagne` or the scale below. Noto Serif's weight and size alone carry the editorial authority.

**Pairing logic:** Noto Serif = *curated data moments* (what the app found). Inter = *functional interface* (what the user does).

---

## Component Patterns

### Main Card (`#mainCard`)
```css
background: var(--surface-container-low);
border-radius: 0.375rem;                    /* 6px — editorial precision */
box-shadow: 0 48px 120px rgba(8, 7, 5, 0.65);  /* ambient, warm-tinted */
/* No backdrop-filter, no inset glow borders */
```

### Buttons — Tactile Signature
- **Primary:** `background: var(--champagne)` · `color: var(--on-primary)` · `border-radius: 0.125rem` (2px cut-diamond)
  - Hover: `background: var(--on-surface)` · `transform: scale(1.01)`
  - No idle shimmer animation — editorial restraint
- **Ghost:** `background: var(--surface-container-lowest)` · ghost border inset at 8% opacity
  - Hover: border opacity → 18%, text → `--champagne`
- Both: `font: 11px Inter 600 · uppercase · 0.1em tracking`

### Range Row
```css
background: var(--surface-container);      /* tonal shift — no border */
border-radius: 0.375rem;
padding: 16px 20px;
```
Note values in Noto Serif 24px/600 — champagne on lock, gold for min, steel for max.

### Result Box — The Editorial Reveal
```css
background: var(--surface-container);
border-radius: 0.375rem;
padding: 24px;
/* Voice type in Noto Serif 48px/600 — the gallery label */
```
Score section divided by a 1px ghost line at 6% opacity.

### Pitch Bar (C2–C6)
```css
background: linear-gradient(
    to top,
    #1A0C00  0%,    /* Deep amber — bass register */
    #C8965A 50%,    /* Warm gold — midrange */
    #7AAFC4 100%    /* Cool steel — treble / soprano */
);
```
- Note labels: `--on-surface-low` — C4 in `--steel` (reference)
- Min marker: `--gold` · Max marker: `--steel`
- No box-shadow glow on markers

### Wave Canvas (WaveEngine)
- Background: `--surface-recess` (`#050503`)
- Trail colour: amber (`#7A4E20`) → warm gold (`#C8965A`) → champagne (`#D4BEA0`) → steel (`#7AAFC4`) — driven by MIDI pitch register
- Pitch bar gradient (right zone): same four-stop amber→steel palette at 20–28% opacity
- Grid lines: `rgba(237,229,216,0.10)` (neutral champagne, not coloured)
- EQ bars: tinted with live pitch colour at 25–55% opacity
- Endpoint dot: champagne core with pitch-coloured glow ring

### Bottom Navigation
```css
background: rgba(8, 8, 10, 0.80);
backdrop-filter: blur(32px);
border-top: 1px solid rgba(237, 229, 216, 0.05);  /* ghost border */
```
- Active tab: `--champagne` — no glow, no drop-shadow
- Inactive: `--on-surface-low` → `--on-surface-mid` on hover

### Stub Pages
- Title in Noto Serif 44px/600 — same editorial authority as results
- Feature list items: `--surface-container-low` background, no border, no shadow
- Badge chip: `--surface-container` bg, sharp 2px corners, 9px Inter ALL CAPS

---

## Shape & Radius Tokens

| Token | Value | Used for |
|---|---|---|
| `--radius` | `0.125rem` (2px) | Buttons, badges, chips — cut-diamond precision |
| `--radius-sm` | `0.375rem` (6px) | Cards, canvas wraps, panels |
| `--radius-xs` | `0.625rem` (10px) | Reserved for inset elements |

No `border-radius: 9999px` pill shapes. Fully rounded elements feel playful — this system demands precision.

---

## Motion Principles

1. **Page entrance:** `page-in` — 0.28s opacity fade only (no translateY — editorial stillness)
2. **No button idle animation** — shimmer/pulse removed; the champagne CTA speaks for itself
3. **Note lock:** `note-lock` — 0.35s spring (`cubic-bezier(0.34, 1.56, 0.64, 1)`) scale burst
4. **Result entrance:** `fade-up` — 0.3s, 6px translateY
5. **Pitch dot:** EMA glide (α=0.08), `opacity 0.2s` transition
6. **Markers / overlays:** `transition: 0.15s–0.35s ease-out`
7. **Record badge:** `record-pulse` — 0.45s × 5, subtle scale 1.04

**Rule:** Motion is functional or celebratory — never ambient. A still interface is authoritative.

---

## Background Treatment

```css
body {
    background: var(--surface);
    background-image: radial-gradient(ellipse 80% 60% at 50% 0%,
        rgba(200, 150, 90, 0.035) 0%,
        transparent 70%);
}
```

A near-invisible warm glow at the top centre — the "light source" from above. No animated blobs, no coloured gradients. The `.bg-blob` elements remain in HTML but are `display: none`.

---

## Layout

### Desktop (> 620px)
- Single-column `studio-layout`, max-width 680px, centred
- `gap: 18px` between sections — not 8px "app-like" tight spacing
- Card padding: `28px 28px 32px`

### Mobile (≤ 620px)
- Padding reduces to `18px 18px 24px`
- Wave canvas height: 260px (from 320px)
- Gap reduces to `14px`

### Bottom Navigation
- Fixed `68px` bar (from 72px — tighter, more precise)
- No rounded top corners — flat edge, professional

---

## Do's and Don'ts

| ✅ Do | ❌ Don't |
|---|---|
| Use tonal surface shifts for depth | Use 1px solid structural borders |
| Use Noto Serif for every data reveal | Mix display fonts across headings |
| Give elements room to breathe — add 24px if unsure | Crowd elements with 8px gaps |
| Use `--champagne` as the single structural white | Use multiple accent colours |
| Use ghost borders (< 10% opacity) as last resort | Use drop-shadows or box-shadow glows |
| Keep animations under 0.35s | Add decorative idle animations |
| Use sharp corners (2px) for interactive elements | Use `border-radius: 9999px` pill buttons |
| Let negative space do the heavy lifting | Fill every pixel with content |
