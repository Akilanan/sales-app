/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Premium in-brand — IBM Plex Sans for UI (distinctive, not Inter), JetBrains
        // Mono for all numbers/data (tabular, engineering-grade).
        sans: ["'IBM Plex Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
        display: ["'IBM Plex Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Premium in-brand — refined zinc-dark surfaces with gradient depth, ONE
        // confident blue accent (tactile gradient buttons), instrument-grade.
        base: "#0A0A0A", // surface-0 canvas (pure zinc, no tint)
        coal: "#131313", // surface-1 sidebar / header band
        panel: "#18181B", // surface-2 cards / panels (zinc-900)
        panelhi: "#212124", // top-edge luminance → premium gradient surfaces (gradient TO panel)
        inset: "#262629", // surface-3 raised: inputs / tracks
        over: "#2D2D30", // surface-4 overlays: modal / dropdown
        hair: "rgba(255,255,255,0.08)",
        "hair-strong": "rgba(255,255,255,0.18)",
        ink: { DEFAULT: "#FAFAFA", soft: "#A1A1AA", dim: "#71717A" },
        // MONOCHROME accent — silver/white scale (active states = white/silver tint;
        // primary buttons = silver-metal gradient with DARK text).
        brand: { 200: "#FAFAFA", 300: "#F4F4F5", 400: "#E4E4E7", 500: "#D4D4D8", 600: "#A1A1AA", 700: "#71717A" },
        viol: { DEFAULT: "#8B5CF6", soft: "rgba(139,92,246,0.14)", ink: "#C4B5FD" },
        steel: { DEFAULT: "#71717A", soft: "#A1A1AA" },
        // shadcn chart palette (dark) — the exact --chart-1..5 tokens from the
        // pasted theme: blue / green / orange / purple / pink. Categorical series.
        chart: { 1: "#2662D9", 2: "#2EB88A", 3: "#E88C30", 4: "#AF57DB", 5: "#E23670" },
        // status — MONOCHROME (user prefers this over colorful): on-track recedes
        // (dim gray), behind brighter gray, critical = brightest (white). Brightness
        // = urgency, zero color. The `chart` tokens above stay defined but unused.
        ok: { DEFAULT: "#52525B", soft: "rgba(82,82,91,0.18)", ink: "#A1A1AA" },
        warn: { DEFAULT: "#A1A1AA", soft: "rgba(161,161,170,0.16)", ink: "#D4D4D8" },
        bad: { DEFAULT: "#FAFAFA", soft: "rgba(255,255,255,0.16)", ink: "#FAFAFA" },
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
        ring: "0 0 0 1px rgba(255,255,255,0.5)",
      },
      keyframes: {
        "pulse-dot": {
          "0%": { boxShadow: "0 0 0 0 rgba(255,255,255,0.5)" },
          "70%": { boxShadow: "0 0 0 5px rgba(255,255,255,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(255,255,255,0)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 2.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};
