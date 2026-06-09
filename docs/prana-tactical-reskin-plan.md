# Prana → "Tactical Ops-Console" Reskin Plan (skin-only overhaul)

> **Decision locked with user:** adopt Aura's *Tactical Intelligence Platform* art direction. **Skin only** — all data logic, bespoke Recharts, a11y (focus-trapped dialog, 44px targets, AA, reduced-motion), and the 3D login hero are preserved. Boldness: **visible but safe**.
> **Design read:** skin-only overhaul of a data-dense industrial production dashboard for shop-floor operators + managers; Tactical ops-console language (cyan/violet on near-black, JetBrains Mono, sharp 2px corners) on the existing Tailwind v3 + bespoke-component system. **Dials:** Variance 6 / Motion 5 / Density 7 (cockpit).
> **Skills to apply:** Impeccable (`/impeccable init` → `/polish` → `/audit`), Design Engineering + design-motion-principles (motion), taste-skill + ui-ux-pro-max + redesign-skill (already loaded). frontend-design bundled.

## Source tokens (Tactical Intelligence Platform)
`bg #020202 · surface #252936 · primary cyan #5EE7FF · secondary/accent violet #8B5CF6 · text #FFFFFF / #A1A1AA · JetBrains Mono (all) · rounded card 2px / control 1px / pill 9999px · tags: feature, bento, charts, animated`

---

## 1. Token layer — `tailwind.config.js` (highest leverage, lowest risk)

**Fonts** (load JetBrains Mono; keep IBM Plex Sans for readable body prose):
```js
fontFamily: {
  sans: ["'IBM Plex Sans'", "ui-sans-serif", "system-ui", "sans-serif"], // body prose stays readable
  mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],               // ALL numbers/labels/eyebrows
  display: ["'JetBrains Mono'", "ui-monospace", "monospace"],            // techy headlines (was Archivo)
}
```

**Colors** — elevation ladder on near-black + cyan primary + violet restrained secondary:
```js
base:    "#020203",  // canvas (near-black, not pure #000 per redesign-skill)
coal:    "#07080B",  // header band / wells
panel:   "#0F1116",  // cards / KPI / chart panels
panelhi: "#161922",  // hero top-edge luminance
inset:   "#1B1F28",  // raised inside a card / inputs / tracks
over:    "#252936",  // overlays (Tactical surface)
hair:        "rgba(120,180,200,0.08)",   // cool/cyan-tinted hairline
"hair-strong":"rgba(94,231,255,0.16)",   // active/input ring (cyan)
ink: { DEFAULT: "#F2F6F7", soft: "#A1A1AA", dim: "#6B7682" },
// brand = CYAN (primary accent). Buttons use DARK text on cyan (white-on-cyan fails AA).
brand: { 200:"#C9F7FF", 300:"#8DE9FB", 400:"#5EE7FF", 500:"#34D2EC", 600:"#1FB6D0", 700:"#1892A6" },
viol:  { DEFAULT:"#8B5CF6", soft:"rgba(139,92,246,0.14)", ink:"#B9A6FF" }, // restrained secondary
steel: { DEFAULT:"#5C6573", soft:"#828C9C" },
ok:   { DEFAULT:"#3FB969", soft:"rgba(63,185,105,0.13)", ink:"#76D89A" }, // status = production state, unchanged
warn: { DEFAULT:"#E0A53C", soft:"rgba(224,165,60,0.13)", ink:"#F0C36A" },
bad:  { DEFAULT:"#F1564C", soft:"rgba(241,86,76,0.13)", ink:"#FF8B83" },
```

**Border radius — shape-lock to SHARP** (Tactical 2px). Overriding the scale sharpens the whole app without touching every className:
```js
borderRadius: { none:"0", sm:"1px", DEFAULT:"2px", md:"2px", lg:"2px", xl:"3px", "2xl":"3px", "3xl":"4px", full:"9999px" },
```

**Shadows** — keep the edge-light technique (depth reads on black); change `ring` to cyan:
```js
ring: "0 0 0 1px rgba(94,231,255,0.5)",
```

## 2. `index.css`
- `body` bg `#090b10 → #020203`; top radial light → cyan `rgba(94,231,255,0.06)`; grid lines cooler.
- Aurora substrate glows → cyan `rgba(34,211,238,0.14)` + violet `rgba(139,92,246,0.12)` + deep teal `rgba(20,90,110,0.12)`.
- `::selection` → cyan `rgba(94,231,255,0.30)`, dark text `#04161a`.
- `*:focus-visible` outline `#2f4bff → #5EE7FF`.
- scrollbar thumb → `rgba(94,231,255,0.18)`.
- `.border-beam` conic → `#5EE7FF` / `#8B5CF6`.
- `.spotlight` radial → cyan `rgba(94,231,255,0.13)`.
- **Add** a subtle static scanline overlay (Tactical CRT) at ~0.02 opacity, reduced-motion-safe, on a fixed `pointer-events-none` layer (keep the film grain too, lower one).

## 3. `index.html`
- Google Fonts link: replace `Archivo` + `IBM Plex Mono` with `JetBrains+Mono:wght@400;500;600;700;800`; keep `IBM Plex Sans`.
- Favicon + `theme-color`: `#2F4BFF → #5EE7FF`, `#0B0D12 → #020203`.

## 4. `src/App.jsx` (mechanical hex swaps + 2 component touches)
- `HEX.brand "#2F4BFF" → "#5EE7FF"` (cascades to all chart ref-lines, now-dot, tooltips, glow flood, activeDot).
- **Button text on cyan → dark** (`text-white → text-[#04161a]`): `btnPrimary`, login `Key` `go` variant, segmented-toggle active label, `credLogin` button, confirm `doSave` button. (white-on-cyan fails AA; dark-on-cyan is the Tactical signature and passes.)
- `Panel` `tag` chip → Tactical motif: render `//{tag}` in cyan mono with a hairline box (e.g. `01 → //01`, `IN → //IN`).
- StaticGlow hero gradient `rgba(47,75,255,…) → rgba(94,231,255,…)`.

## 5. `src/lib/Ambient.jsx` + `src/lib/Cursor.jsx`
- `ACCENT.ok "#2F4BFF" → "#5EE7FF"`; rim/edge light to cyan; StaticGlow rgba swaps.
- Cursor point `#2F4BFF / rgba(47,75,255) → #5EE7FF` (keep cursor; it's gated to fine-pointer desktop).

## 6. Verify (definition of done)
- `npm run build` clean (0 errors).
- Playwright in-browser: login + dashboard + shift-entry + plan-setup render in the new skin, **0 console errors**.
- Contrast: cyan buttons use dark text (AA); ink/soft/dim on `#0F1116` all clear AA.
- Both motion + reduced-motion paths OK; 3D hero still loads (and static fallback recolored).
- Run `/polish` then `/audit` (Impeccable) as the final passes.

---

## Handoff state (as of this writing)
- **Done:** studied all 621 Aura systems; wrote `docs/aura-design-md-study.md`, `docs/aura-full-catalog-621.md`, `docs/aura-top30-design-systems.md`, `docs/aura-prana-relevant-systems.md` (60 full), `docs/PRANA-DESIGN.md`. Read entire current app. Loaded ui-ux-pro-max + redesign-skill + taste-skill.
- **User is installing** (paste & run, then restart Claude Code): `pbakaus/impeccable`, `emilkowalski/skill --skill emil-design-eng`, `kylezantos/design-motion-principles`, `muninn-huginn/taste-create`. (taste-skill + frontend-design already present.)
- **Next on resume:** `/impeccable init` → execute sections 1-5 above → section 6 verify → `/polish` + `/audit`.
- **Background research workflow** (award-grade dashboard brief) may still be running; fold its findings into refinements when it lands.
