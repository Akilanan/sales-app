// motion.js — the single source of truth for the app's motion "feel".
//
// Replaces the scattered spring/easing magic-numbers that had crept across
// App.jsx, the nav, and the buttons. Tuned per a 2026 motion audit (Emil
// Kowalski, Rauno Freiberg, Motion docs, Material 3): an INSTRUMENT dashboard
// wants FAST + low-bounce + spatially-correct, not springy. Damping ratios sit
// in the 0.7–1.0 band (near-critically-damped) so motion settles crisply; one
// slightly springier preset (`nav`) is the single signature moment.

// ---- Spring presets (interruptible / gesture / layout motion) ---------------
export const spring = {
  // taps & toggles — near-zero bounce, immediate
  tap:   { type: "spring", stiffness: 400, damping: 30 },
  // the tubelight nav lamp (layoutId) — crisp slide, the one signature spring
  nav:   { type: "spring", stiffness: 380, damping: 34 },
  // cards / rows / hovers
  card:  { type: "spring", stiffness: 300, damping: 30 },
  // modals / drawers — a touch of weight (mass) so big surfaces feel substantial
  modal: { type: "spring", stiffness: 300, damping: 30, mass: 1.1 },
  // small pop-ins (pin dots, chips)
  pop:   { type: "spring", stiffness: 500, damping: 32 },
};

// ---- Easing curves (single-element enter/exit, color, layout-free moves) -----
// out      → ease-out-expo: very fast start, long gentle settle (Vercel/Linear).
// standard → Material 3 standard: start & end at rest.
// emphasis → Material 3 emphasized-decelerate: large/hero entrances.
// accel    → Material 3 standard-accelerate: things LEAVING the screen.
export const ease = {
  out:      [0.16, 1, 0.3, 1],
  standard: [0.2, 0, 0, 1],
  emphasis: [0.05, 0.7, 0.1, 1],
  accel:    [0.3, 0, 1, 1],
};

// ---- Duration scale (seconds) — Material 3 + Rauno's ≤200ms interaction rule -
// Exits should run ~20% faster than the matching entrance (use dur.* * 0.8).
export const dur = {
  hover: 0.12,  // hover / press feedback
  pop:   0.2,   // tooltips, chips — Rauno's direct-interaction ceiling
  modal: 0.25,  // dialog / sheet open
  page:  0.3,   // route / view transition
  hero:  0.45,  // large, deliberate, rare
};

// Convenience tween builders so call-sites read intent, not numbers.
export const tween = (d = dur.page, e = ease.out) => ({ duration: d, ease: e });
export const exitTween = (d = dur.page, e = ease.accel) => ({ duration: d * 0.8, ease: e });
