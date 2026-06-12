# Design

⚠️ **SUPERSEDED (June 2026).** The live direction is **"shadcn premium" — MONOCHROME zinc** (grayscale charts where brightness = urgency, LiquidButton glass + MetalButton silver, tubelight pill nav, Spline-robot login on pure black). Everything below (Command Deck cyan, sidebar nav) is HISTORY — do not re-apply it. The shipped app (`src/`) is the source of truth.

> Visual system for Prana Venture's production console. Direction: **Command Deck** — the data-driven best-of-all-621-Aura systems (Linear/Geist-grade), the standard `/polish` and `/audit` hold edits to.
>
> **Command Deck deltas (current — override the Tactical values below where they conflict):**
> - **Canvas** `#07090C` near-black (lifted off pure black → no halation) · panels `#11141A` gunmetal.
> - **Accent** electric cyan `#22D3EE` (primary fills/active) + `#5EE7FF` (bright thin marks/chart signal); violet `#8B5CF6` rare. Buttons = cyan fill + dark text `#04161a`.
> - **Radius `8px` tier** (the proven 50%-of-621 norm — NOT sharp 2px): panels `[10px]`, controls/cards `rounded-lg` 8px, status pills 6px, meter micro 2px, pill 9999.
> - **Nav = LEFT SIDEBAR** (240px desktop / 68px icon rail on tablet; active = cyan bg-tint + 2px accent bar + filled icon), replacing top-nav.
> - **Type** IBM Plex Sans for ALL UI (clean headers, not mono) + JetBrains Mono for ALL numbers/data (tabular).
> - Dashboard trends toward **active** (clickable problems → drill/act). Keeps: bespoke Recharts (cyan marks), edge-light depth, a11y, 3D login hero, `//01` panel tags, crosshair motifs.

## Theme

Real-time industrial command console on near-black. One cyan accent for signal, violet as a rare secondary, production status hues (green/amber/red) reserved strictly for "are we on track". Density is a feature: mono numbers, hairline dividers, sharp 2px corners. Depth comes from a 5-step luminance ladder + edge-light borders (white insets read on black; black drop shadows do not). Color strategy: **Restrained** (tinted-neutral surfaces + one accent ≤10% of surface).

## Color palette

Surfaces (5-step elevation ladder, near-black → gunmetal; child always one step lighter than parent):
- `base` canvas `#020203`
- `coal` header band / wells `#07080B`
- `panel` cards / KPI / charts `#0F1116`
- `panelhi` hero top-edge luminance `#161922`
- `inset` raised inside a card / inputs / tracks `#1B1F28`
- `over` overlays (modal / dropdown) `#252936`

Ink (cool near-white ramp): `ink #F2F6F7` (≥15:1 on panel) · `ink-soft #A1A1AA` (~7:1) · `ink-dim #6B7682` (~4.6:1).

Accent — **cyan** (primary signal; CTAs use DARK text on cyan, white-on-cyan fails AA):
`brand-200 #C9F7FF · 300 #8DE9FB · 400 #5EE7FF · 500 #34D2EC · 600 #1FB6D0 · 700 #1892A6`. Used ONLY for: primary CTA, focus ring, current selection, nav underline, chart reference marks / now-dot. Never a per-row badge or per-card border.

Secondary — **violet** (rare): `#8B5CF6` (soft `rgba(139,92,246,0.14)`, ink `#B9A6FF`). One restrained role (realtime indicator / a single secondary series).

Neutral magnitude — **steel** `#5C6573` / `#828C9C` (on-plan bars; not the accent).

Status (production state ONLY, with a word + position, never color alone):
`ok #3FB969 / ink #76D89A` · `warn #E0A53C / ink #F0C36A` · `bad #F1564C / ink #FF8B83`.

Hairlines: `hair rgba(120,180,200,0.08)` · `hair-strong rgba(94,231,255,0.16)` (active/input). Focus ring: cyan `#5EE7FF`, 2px, 2px offset.

## Typography

Fixed rem scale (product UI, not fluid). Families (≤3, contrast axis):
- **Display / titles**: JetBrains Mono (techy headers — the ops-console signature).
- **Body prose / labels**: IBM Plex Sans (kept for readability of longer text).
- **Numbers / eyebrows / codes**: JetBrains Mono, always `tabular-nums`.

Scale (px): 11 (eyebrow/cap, min) · 13 (label/body-sm) · 15/16 (body) · 19 (entry qty) · 28 (shift cell) · 32 (KPI) · 40 (today actual) · hero clamp max ≤ 56px. Weight contrast ≥ 1.25 between steps; display letter-spacing ≥ -0.03em. No all-caps body; uppercase only for ≤4-word labels.

## Components

Every interactive component ships: default / hover / focus / active / disabled / loading / error.
- **Buttons** — primary = solid cyan + dark text (`#04161A`), hover deepens to `brand-600`; secondary = inset + hairline ring, cyan only on hover. ≥44px.
- **Cards / panels** — `bg-panel` + edge-light shadow (inset top hairline + perimeter ring + soft ambient). Sharp 2px corners. No nested cards.
- **Meter** — squared track + hairline tick dividers (engineering gauge), 2px radius; status-coloured or steel.
- **Status pill** — soft-tint bg + ink text + word; no trend arrows.
- **Panel index tag** — mono `//01`-style chip in a hairline box (deliberate ops-console sequence, not decorative numbering).
- **Inputs** — `bg-inset` + `hair-strong` border, cyan focus border; numeric steppers ≥44px; date picker dark.
- **Empty / loading / error** — composed empty states (crosshair marks + "NO DATA" + guidance), skeleton-not-spinner where content loads, inline error below field + surfaced save errors.

## Layout

8pt grid. Section rhythm 20px; card padding 20px (lead 24px). Max content width `max-w-6xl`. Responsive is structural (12-col asymmetric dashboard grid → single column < 768px; nav collapses to a tap-dense row on mobile; tables scroll-x with a min-width). Three radius tiers, all sharp: outer 2–3px (panels/modal) · control 2px (inputs/buttons/chips) · micro 2px (meter); pill 9999px reserved for the live dot only.

## Motion

150–250ms, conveys state not decoration (feedback, reveal, count-up, nav underline, dialog from trigger). Ease-out exponential; no bounce. Staggered list entrances are fine; no orchestrated full-page load sequence beyond the login→app threshold. Reduced-motion → instant/crossfade everywhere (MotionConfig reducedMotion="user" + CSS belt). Realtime = a single cyan border-beam on the live panel only.

## Accessibility

WCAG AA floor (AAA on primary numbers). Verified contrast on cyan (dark text). Status word + position, never hue alone. Reduced-motion, ≥44px targets, focus-trapped dialog (Esc + restore), tabular figures, keyboard order = visual order.

## Bans (this project)

No side-stripe colored borders >1px as decoration (use full hairline or a status bar). No gradient-clipped text. No glassmorphism-by-default. No icon-in-a-tinted-box on headings/nav/KPIs. No glow-soup — cyan/violet stay as precise signal. No fluid display headings in app chrome.
