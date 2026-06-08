# Design System: PRANA VENTURE — "Signal"

Premium, animated production console. Built so the **experience feels world-class**
(cinematic motion, depth, a living 3D ambient layer) while the **work screens stay
instantly legible** for shop-floor operators. Grounded in ISA-101 High-Performance
HMI clarity + Stitch anti-generic taste.

Atmosphere sliders → **Density 5** (data-rich but breathable) · **Variance 4**
(structured, lightly asymmetric — clarity first) · **Motion 7** (fluid, choreographed,
spring-physics — but never gratuitous on data).

## 1. Visual Theme & Atmosphere
A bright, architectural workspace with calm depth and a slow-moving ambient gradient
field behind key surfaces. Surfaces are crisp near-white planes floating on a soft
zinc canvas; one confident cobalt accent carries identity and intent; status (green /
amber / red) is reserved strictly for "are we on track?" and always paired with a
label + icon. The feeling: precise, alive, and expensive — a control room designed by
a product studio, not a SCADA vendor.

## 2. Color Palette & Roles
- **Zinc Canvas** (#EEF0F4) — app background; carries the ambient gradient field
- **Pure Surface** (#FFFFFF) — cards, panels, header
- **Frost Surface** (#F6F8FB) — insets, tracks, secondary fills
- **Off-Black Ink** (#11151C) — primary text (never pure #000)
- **Steel Ink** (#586375) — secondary text, labels, metadata
- **Mute Ink** (#8A93A3) — tertiary text, captions
- **Hairline** (#E2E6EE) — 1px structural borders
- **Signal Cobalt** (#2F54EB) — THE single accent: identity, primary CTA, active nav,
  focus rings, the trend line (saturation kept measured, never neon)
- **Cobalt Wash** (rgba(47,84,235,0.08)) — accent tints, active surfaces
- **Status — On Track** (#15A349 / soft #E7F6EC / ink #15803D)
- **Status — Behind** (#E8910A / soft #FCF1D6 / ink #B45309)
- **Status — Critical** (#E0322F / soft #FCE7E7 / ink #B91C1C)
> Max ONE accent. No purple/neon glows. Status hues never used for decoration.

## 3. Typography
- **Display + Body:** `Geist` — track-tight headings, weight-driven hierarchy (Inter BANNED)
- **Numerics + codes:** `Geist Mono` — all metric values, KPIs, machine codes, timestamps (tabular)
- Headlines scale with `clamp()`; body min 14px; max ~65ch on prose.

## 4. Component Stylings
- **Buttons:** flat cobalt fill (primary) / hairline ghost (secondary). Tactile press
  (scale 0.98 + 1px down). No outer glow. Spring on hover lift.
- **Cards/Panels:** generously rounded (1.25–1.5rem), hairline border + soft tinted
  shadow. Subtle pointer-tracked tilt on hero cards only. Elevation = hierarchy.
- **KPI tiles:** neutral; big mono number; status only in the delta line.
- **Glance Status banner:** the hero — colored status rail + big mono ratio + status
  pill, readable in 2s (Andon principle).
- **Inputs:** label above, cobalt focus ring, error below. Big touch targets (≥56px).
- **Loaders:** skeletal shimmer matching layout (no spinners).
- **Empty states:** composed, instructive — never bare "No data".

## 5. Layout
CSS-grid first, max-width 1152px centered, generous padding. Single-column collapse
< 768px, zero horizontal overflow. Operator controls ≥60px touch targets, glove-safe
spacing. Full-height via `min-h-[100dvh]`.

## 6. Motion & Interaction (the "experience")
- **Engine:** Framer Motion. **Spring default** `stiffness 200, damping 26` (weighty, premium).
- **Page transitions:** shared-layout, soft rise + fade between views.
- **Staggered reveals:** panels/rows cascade in (≤60ms steps) — never instant. Numbers
  count up ONCE on mount, isolated from layout animation (no re-render fights).
- **Micro-interactions:** hover lift on cards, animated nav pill (layoutId), animated
  progress + chart draw-in, tactile presses, a "live" pulse.
- **3D ambient layer:** a low-cost `react-three-fiber` shader-gradient mesh behind the
  login hero + dashboard masthead — slow, desaturated cobalt/teal flow. Lazy-loaded,
  capped DPR, disabled on `prefers-reduced-motion` and small/low-power devices.
- **Performance:** animate `transform`/`opacity` only. 3D isolated + suspended.

## 7. Anti-Patterns (banned)
No emojis · no Inter · no pure black · no neon/purple glows · no oversaturated accents ·
no 3 equal feature cards · no AI clichés ("Elevate/Seamless/Next-Gen") · no spinners ·
no decorative use of status color · no motion that delays reading a number.
