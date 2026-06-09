/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Command Deck: ONE clean premium sans carries display + body + labels
        // (Impeccable product register: one family is often right); JetBrains Mono
        // for ALL numbers/data/codes = engineering-grade tabular figures.
        sans: ["'IBM Plex Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
        display: ["'IBM Plex Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // "Tactical Ops-Console" — near-black canvas, gunmetal surfaces, ONE cyan
        // signal accent + a restrained violet secondary (adopted from Aura's Tactical
        // Intelligence Platform). Status = production state ONLY (green/amber/red).
        // 5-step luminance elevation ladder (near-black → gunmetal) — each child sits
        // one step lighter than its parent so nesting reads as real planes, not flat DOM.
        base: "#07090C", // surface-0 canvas (near-black, lifted off pure #000 → no halation)
        coal: "#0B0E12", // surface-1 sidebar / header band / deep wells
        panel: "#11141A", // surface-2 cards / KPI / chart panels / glance
        panelhi: "#171B22", // top-edge luminance for hero surfaces (gradient TO panel)
        inset: "#1A1F27", // surface-3 raised: tracks/inputs/keycaps INSIDE a card, hover
        over: "#222834", // surface-4 overlays: modal / dropdown / confirm
        hair: "rgba(120,180,200,0.08)", // cool/cyan-tinted hairline
        "hair-strong": "rgba(34,211,238,0.16)", // input outline / active ring (cyan)
        ink: { DEFAULT: "#F2F6F7", soft: "#A1A1AA", dim: "#6B7682" },
        // brand = CYAN signal (proven cyan scale; buttons use DARK text on cyan — white-on-cyan fails AA)
        brand: { 200: "#A5F3FC", 300: "#67E8F9", 400: "#5EE7FF", 500: "#22D3EE", 600: "#06B6D4", 700: "#0E7490" },
        // restrained secondary accent (one rare role: realtime / a single 2nd series)
        viol: { DEFAULT: "#8B5CF6", soft: "rgba(139,92,246,0.14)", ink: "#B9A6FF" },
        steel: { DEFAULT: "#5C6573", soft: "#828C9C" },
        // status — reserved strictly for "are we on track?"
        ok: { DEFAULT: "#3FB969", soft: "rgba(63,185,105,0.13)", ink: "#76D89A" },
        warn: { DEFAULT: "#E0A53C", soft: "rgba(224,165,60,0.13)", ink: "#F0C36A" },
        bad: { DEFAULT: "#F1564C", soft: "rgba(241,86,76,0.13)", ink: "#FF8B83" },
      },
      // Command Deck radius: 8px is the proven library norm (50% of 621). Tiered so the
      // whole app updates via the scale; arbitrary panel radii handled in App.jsx.
      borderRadius: {
        none: "0", sm: "4px", DEFAULT: "6px", md: "6px", lg: "8px",
        xl: "10px", "2xl": "12px", "3xl": "16px", full: "9999px",
      },
      boxShadow: {
        // Linear-style LAYERED edge-light (the depth cue that reads on near-black):
        // line 1 = top specular hair-light, line 2 = full-perimeter inset ring,
        // line 3 = ambient lift. White insets do the work; black drop is invisible on dark.
        card: "inset 0 1px 0 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.035), 0 14px 38px -16px rgba(0,0,0,0.7)",
        "card-hover": "inset 0 1px 0 0 rgba(255,255,255,0.11), inset 0 0 0 1px rgba(255,255,255,0.055), 0 20px 46px -16px rgba(0,0,0,0.78)",
        // Hero surfaces (glance banner, lead KPIs, the two top chart panels): a
        // brighter TOP hairline so the upper edge catches light and the panel
        // visibly sits above the canvas — the fix for "reads dark/flat at top".
        hero: "inset 0 1px 0 0 rgba(255,255,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.045), 0 18px 46px -18px rgba(0,0,0,0.74)",
        raise: "inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.04), 0 22px 55px -20px rgba(0,0,0,0.8)",
        pop: "inset 0 1px 0 0 rgba(255,255,255,0.09), inset 0 0 0 1px rgba(255,255,255,0.05), 0 48px 95px -26px rgba(0,0,0,0.85)",
        ring: "0 0 0 1px rgba(94,231,255,0.5)",
      },
      keyframes: {
        "pulse-dot": {
          "0%": { boxShadow: "0 0 0 0 rgba(94,231,255,0.5)" },
          "70%": { boxShadow: "0 0 0 5px rgba(94,231,255,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(94,231,255,0)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 2.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};
