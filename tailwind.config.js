/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'IBM Plex Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
        display: ["Archivo", "'IBM Plex Sans'", "sans-serif"],
      },
      colors: {
        // "Cold Steel + Electric Signal" — arctic graphite near-black, cool
        // off-white ink, ONE solid electric-blue accent (no neon, no glow).
        // Drawn from igloo (steel monochrome + atmosphere) + lusion (Klein-blue
        // + matte 3D + crosshair precision). Status = production state ONLY.
        // 5-step luminance elevation ladder (cool ~228 hue) — each child sits one
        // step lighter than its parent so nesting reads as real planes, not flat DOM.
        base: "#090B10", // surface-0 canvas (dropped darker so panels sit ABOVE it)
        coal: "#0E1117", // surface-1 header band / deep section wells
        panel: "#14171D", // surface-2 cards / KPI / chart panels / glance
        panelhi: "#181C24", // top-edge luminance for hero surfaces (gradient TO panel)
        inset: "#1A1E26", // surface-3 raised: tracks/inputs/keycaps INSIDE a card, hover
        over: "#222838", // surface-4 overlays: modal / dropdown / confirm
        hair: "rgba(220,228,242,0.07)",
        "hair-strong": "rgba(220,228,242,0.13)", // input outline / active ring / 2nd border weight
        ink: { DEFAULT: "#ECEFF4", soft: "#A2ABBC", dim: "#8A93A4" },
        // brand = electric / Klein blue (solid fills only — never a glow)
        brand: { 200: "#C8CFFF", 300: "#9AA6FF", 400: "#6273FF", 500: "#2F4BFF", 600: "#1E36E6", 700: "#152AA6" },
        steel: { DEFAULT: "#5C6573", soft: "#828C9C" },
        // status — cool-tuned, reserved strictly for "are we on track?"
        ok: { DEFAULT: "#3FB969", soft: "rgba(63,185,105,0.13)", ink: "#76D89A" },
        warn: { DEFAULT: "#E0A53C", soft: "rgba(224,165,60,0.13)", ink: "#F0C36A" },
        bad: { DEFAULT: "#F1564C", soft: "rgba(241,86,76,0.13)", ink: "#FF8B83" },
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
        ring: "0 0 0 1px rgba(47,75,255,0.45)",
      },
      keyframes: {
        "pulse-dot": {
          "0%": { boxShadow: "0 0 0 0 rgba(47,75,255,0.45)" },
          "70%": { boxShadow: "0 0 0 5px rgba(47,75,255,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(47,75,255,0)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 2.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};
