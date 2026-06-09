---
version: "prana-cold-steel-electric-signal-2026-06"
name: "Prana Venture — Cold Steel + Electric Signal"
description: >
  Production-tracking dashboard for a manufacturing venture. The look is
  arctic-graphite near-black with ONE solid electric/Klein-blue accent — no neon,
  no glow, solid fills only. Status hues (green/amber/red) are reserved STRICTLY
  for production state, never decoration. Built for dense, readable operational
  screens (KPI strips, shift entry, variance charts), with a single matte
  brushed-steel 3D hero on the login screen only. Suitable for industrial /
  ops / analytics interfaces that must read "human-crafted & award-grade," not
  "AI-default SaaS."

# --- Aura's 8 core color roles ---
colors:
  primary:        "#2F4BFF"   # brand-500 — electric/Klein blue. CTAs, focus ring, chart ref marks ONLY.
  secondary:      "#5C6573"   # steel — neutral magnitude bars, on-plan states (NOT brand)
  accent:         "#6273FF"   # brand-400 — hover/lighter brand step only
  background:     "#090B10"   # surface-0 canvas
  surface:        "#14171D"   # surface-2 cards / KPI / chart panels
  text-primary:   "#ECEFF4"   # ink (15.6:1 on panel)
  text-secondary: "#A2ABBC"   # ink-soft (7.8:1)
  border:         "#222838"   # hairline / surface-4 overlay edge

# --- extended tokens (DESIGN.md is just markdown; these go beyond Aura's 8) ---
elevation:                    # 5-step ladder — child is ALWAYS one step lighter than parent
  base:    "#090B10"          # canvas
  coal:    "#0E1117"          # header band / deep wells
  panel:   "#14171D"          # cards
  panelhi: "#181C24"          # top-edge luminance for hero surfaces (gradient TO panel)
  inset:   "#1A1E26"          # tracks/inputs/keycaps inside a card, hover
  over:    "#222838"          # modal / dropdown / confirm

brand-scale:
  "200": "#C8CFFF"
  "300": "#9AA6FF"
  "400": "#6273FF"
  "500": "#2F4BFF"            # primary
  "600": "#1E36E6"            # primary hover (DARKEN — white-on-400 fails AA)
  "700": "#152AA6"

ink:
  default: "#ECEFF4"          # 15.6:1
  soft:    "#A2ABBC"          # 7.8:1
  dim:     "#8A93A4"          # 5.8:1

status:                       # production state ONLY — never decoration
  ok:   "#3FB969"             # On Track   (ink #76D89A, soft rgba(63,185,105,.13))
  warn: "#E0A53C"             # Behind     (ink #F0C36A)
  bad:  "#F1564C"             # Critical   (ink #FF8B83)

typography:
  display-lg:
    family: "Archivo"
    size:   "clamp(40px, 6vw, 64px)"
    weight: 600
    note:   "display / titles / wordmark"
  body-md:
    family: "IBM Plex Sans"
    size:   "16px"
    weight: 400
    note:   "body / sub-lines"
  label-md:
    family: "IBM Plex Mono"
    size:   "11px"            # 11px MIN for eyebrows/caps; 10px ONLY chart axis/legend
    weight: 600
    transform: "uppercase"
    feature: "tabular-nums (.tnum) ALWAYS on numbers"
    note:   "ALL numbers + eyebrows + labels"
  number-ladder:              # explicit px — no half-px sizes
    entry-qty: "19px"
    shift-cell: "28px"
    kpi: "32px"
    today-actual: "40px"

spacing:
  base:            "8px"      # 8pt grid
  gap:             "16px"
  card-padding:    "20px"     # p-5  (lead card p-6 = 24px)
  section-rhythm:  "20px"     # mb-5 between sections

rounded:                      # 3 tiers ONLY
  card:    "14px"             # outer: panels / cards / modal
  control: "12px"             # inner: inputs / keys / chips / buttons (8px for smallest)
  micro:   "2px"              # Meter track
  pill:    "9999px"

components:
  card:
    background: "#14171D"
    shadow: "inset 0 1px 0 rgba(255,255,255,.06), inset 0 0 0 1px rgba(255,255,255,.035), 0 8px 24px rgba(0,0,0,.4)"
    note: "edge-LIGHT borders (white insets), NOT black drop shadows — black is invisible on near-black"
  button:
    primary:   "solid brand-500; hover DARKENS to brand-600 (#1E36E6)"
    secondary: "inset + ring; brand only on hover"
    min-height: "44px"
  meter:
    note: "squared track + hairline tick dividers (engineering gauge), micro 2px radius — NOT rounded-full consumer pills"
  nav:
    note: "TEXT-ONLY links + animated 2px brand underline (Framer layoutId). NEVER a solid-blue pill."
---

# Prana Venture — Cold Steel + Electric Signal

Source: internal Prana design system (codified from `tailwind.config.js`, `src/index.css`,
`src/App.jsx`, `src/lib/Ambient.jsx`). References: igloo.inc (steel monochrome + atmosphere)
and lusion.co (Klein-blue + matte material). Tags: dashboard, charts, industrial, dark,
3d, webgl, kpi, variance, production, anti-ai-tell.

## Overview
A dense operational dashboard for tracking manufacturing output against plan. Arctic
graphite canvas, off-white ink, and a single restrained electric-blue signal. Screens:
login (3D hero), Dashboard (KPI strip + 4 bespoke charts), Shift Entry, Plan Setup.
The brand is carried by the **Archivo "PRANA VENTURE" wordmark** — there is no gem /
hexagon / icon-in-box symbol.

## Composition
Use `src/App.jsx` (the Dashboard) as the source of truth. Preserve the visible hierarchy,
first-screen composition, section rhythm, and density before adapting copy. Dashboard and
ShiftEntry rows use a **12-col ASYMMETRIC grid** (lead column wider) — not relentless 50/50.
KPI strip = **4 equal dense tiles** (Produced-today gauge · Avg/working-day sparkline ·
Scrap MTD magnitude bar · Working-days-left progress), non-redundant with the glance banner.

## Colors
Anchor the palette in primary `#2F4BFF`, on canvas `#090B10`, surfaces `#14171D`, ink
`#ECEFF4` / `#A2ABBC`. **RESERVE-BLUE (hard rule):** `#2F4BFF` appears ONLY on the primary
CTA, the nav underline, the focus ring, chart reference marks / now-dot, and the ONE brand
info-callout. NEVER a per-row badge, per-card border, or multiple filled chips. Neutral
magnitude bars use **steel `#5C6573`**, not brand. Status hues (`#3FB969` / `#E0A53C` /
`#F1564C`) signal production state ONLY — color = exception (on-plan rows stay steel /
hollow). Keep background → surface → inset → over as a 5-step elevation ladder; a child
surface is always one step lighter than its parent.

## Typography
Use **Archivo** for display / titles / the wordmark, **IBM Plex Sans** for body and
sub-lines, and **IBM Plex Mono** for ALL numbers, eyebrows, and labels (always tabular-nums).
Do NOT use Inter / Geist / Space Grotesk — those read as the AI-default stack. Mono number
ladder is explicit: 19 (entry qty) / 28 (shift cell) / 32 (KPI) / 40 (Today actual). Eyebrows
≥ 11px (10px only for chart axis/legend). No half-px sizes. Page headings are solid `#ECEFF4`
with a `border-l-2 border-brand-500` rule — never white→ink-soft gradient-clipped text.

## Layout
8pt grid. Section rhythm `mb-5` (20px); card padding `p-5` (lead `p-6`). **Three radius tiers
only:** outer 14px (panels/cards/modal), inner 12–8px (inputs/keys/chips/buttons), micro 2px
(Meter). Apply the `PANEL_HERO` gradient (`panelhi → panel` + brighter top hairline) SPARINGLY
(glance banner + 2 top chart panels only — overuse is a template tell). Background carries a
top-down cool radial light + a slow drifting aurora substrate; opaque cards block it so it
only breathes through gutters.

## Components
- **KPI tiles:** eyebrow → 32px mono number+unit → context sub → ONE micro-viz. Keep the
  panel-bg + white-number treatment (the liked look); only density/placement vary.
- **Meter (progress):** squared track + hairline tick dividers, micro 2px radius. Engineering
  gauge, not a consumer rounded-full bar.
- **Charts (bespoke, stock Recharts — do NOT regress to stock grouped-bar/flat-area):**
  (1) diverging DEVIATION bar (color = miss, steel = on/ahead, brand zero-rail);
  (2) THRESHOLD-SPLIT stepAfter area (green-above / amber-below the daily target, live pulse dot);
  (3) per-row ACTION DOT (lit only for an exception) + sparkline + variance chip.
  Always compare actual vs the **prorated expected-to-date**, never the full-month target.
- **Status pills:** color + word only — NO trend arrows. **Nav:** text-only + animated 2px
  brand underline, never a solid-blue pill. **Buttons:** primary solid brand (hover darkens
  to `#1E36E6`); secondary inset+ring (brand on hover). All touch targets ≥ 44px.

## Motion
Framer Motion, wrapped in `MotionConfig reducedMotion="user"`. Masked reveals, staggered
entrance, hover lift, scroll-triggered transitions — easing smooth and restrained. Custom
eased trailing-ring cursor with an electric-blue point (desktop-mouse only; coarse-pointer
and reduced-motion keep the native cursor).

## WebGL & Effects
Login hero ONLY: one matte, studio-lit, **brushed-steel** machined spindle (LatheGeometry) +
an extruded "PRANA" wordmark + a frosted blue-glass crystal accent. Rules that must not
regress: metal reads MATTE brushed steel, NOT glossy chrome — `MeshPhysicalMaterial`,
metalness 0.7 / roughness ~0.46 / envMapIntensity ~0.62, faint anisotropy + soft clearcoat;
reflections come from a baked drei `<Environment frames={1}>` Lightformer studio, not point
lights; the blue is a restrained EDGE KISS (rim light intensity ~3, never ~15 — a strong
point light floods the body into the "AI-rendered blob" look). ACES tone curve (never set
Canvas `flat`). Perf: `setFrameloop('never')` when hidden/offscreen, adaptive DPR, ContactShadows
only (no per-frame cast-shadow), dispose geometry on unmount. **Do NOT add WebGL postprocessing
(`@react-three/postprocessing`)** on this R3F v8 stack — it floods `glBlitFramebuffer` depth-stencil
warnings. The cinematic glow is a ZERO-COST CSS grade (soft blue bloom radial behind the part +
edge vignette overlay). Work screens stay 3D-free and fast.

## Guardrails (Prana hard rules — anti-AI-tell)
- NO icon-in-a-tinted-box on headings, nav, or KPI/stat cards (the #1 AI tell). Nav is text-only;
  headings stand alone with a `border-l-2 border-brand-500` rule. Icons ONLY where functional.
- NO solid-blue nav pill — use the animated 2px brand underline.
- NO trend/up-down arrows on status pills (color already conveys state).
- NO gradient-clipped (`white → ink-soft`) heading text — solid ink only.
- NO gem / hexagon / icon-in-box logo — the Archivo wordmark IS the brand.
- Reserve `#2F4BFF` for the 5 sanctioned uses; everything neutral is steel `#5C6573`.
- Status color is production-state ONLY; never decorative.
- Edge-LIGHT shadows (white insets), never black drop shadows on near-black.
- Do NOT reintroduce: warm amber/brown, cyan neon, blotchy multi-radial corner glows,
  glassmorphism on every panel, Lucide icons, Geist / Space Grotesk / Inter, round fake seed numbers.
- Preserve the first-viewport signal, focal object, and visual density; keep buttons, cards,
  and badges aligned to the same radius and border language.
