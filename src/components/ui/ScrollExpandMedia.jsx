// ScrollExpandMedia — the cinematic SPLIT login (single screen, no scroll).
//
// Composition (back → front), per the original 21st.dev splite demo: the robot
// sits on PURE BLACK — no backdrop photo, no extra 3D objects, no color grade.
//   1. optional ambient 3D layer (`scene` prop) — currently unwired (null);
//      Ambient.jsx is kept on disk for cheap reversal.
//   2. the white Spotlight beam.
//   3. the split grid —
//        LEFT  (lg+): the INTERACTIVE Spline robot (pasted 21st.dev component —
//               looks at / follows the cursor) under a holographic scan-line
//               overlay, with the boot sequence + brand lockup floating above it.
//               Loads from prod.spline.design (CDN) — wrapped in Suspense + an
//               error boundary so an offline shop floor still gets the black
//               panel + brand text, never a broken panel.
//        RIGHT: the sign-in card (children) on a frosted panel with a
//               cursor-following spotlight sheen.
// Mobile (<lg): the left showcase is hidden (saves the robot's CDN download);
// the sign-in card centres on the black backdrop.
import React from "react";
import { m } from "framer-motion";
import { Spotlight } from "./spotlight";
import { CursorSpotlight } from "./spotlight-cursor";
import { SplineScene } from "./splite";
import { ease, dur } from "../../lib/motion";
import { LOW_POWER } from "../../lib/power";

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The 21st.dev demo's interactive robot-head scene (cursor-tracking).
const SPLINE_SCENE = "https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode";

// Mount the robot ONLY at lg+ widths. The left panel is `hidden lg:block`, so
// without this gate Spline still mounts into a display:none container — a
// zero-size canvas that spams GL_INVALID_FRAMEBUFFER_OPERATION every frame and
// downloads the multi-MB CDN scene on phones that never show it.
function useIsDesktop() {
  const [wide, setWide] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e) => setWide(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}

// If the Spline runtime or its CDN scene fails, the panel falls back to the
// black panel + brand text — never a broken login.
class SplineErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — ambient layers carry the hero */ }
  render() { return this.state.failed ? null : this.props.children; }
}

// ---- holographic boot sequence ------------------------------------------------
const BOOT_LINES = [
  ["01", "SPINDLE CALIBRATION"],
  ["02", "LIGHT RIG · ENV BAKE"],
  ["03", "TELEMETRY LINK"],
];

function BootSequence() {
  return (
    <m.div
      initial={REDUCED ? false : "hidden"}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.45, delayChildren: 0.6 } } }}
      className="mt-7 max-w-xs space-y-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-dim"
    >
      {BOOT_LINES.map(([n, label]) => (
        <m.p
          key={n}
          variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: ease.out } } }}
          className="flex items-baseline gap-3"
        >
          <span className="text-ink-dim/60">//{n}</span>
          <span>{label}</span>
          <span className="flex-1 min-w-4 border-b border-dotted border-ink-dim/30 translate-y-[-3px]" aria-hidden="true" />
          <span className="text-ink-soft">OK</span>
        </m.p>
      ))}
      <m.p
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.35 } } }}
        className="pt-2 flex items-center gap-2.5 text-ink-soft"
      >
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-ink-soft motion-safe:animate-ping opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ink" />
        </span>
        SYSTEM ONLINE
      </m.p>
    </m.div>
  );
}

export default function ScrollExpandMedia({ title, date, scene, children }) {
  const isDesktop = useIsDesktop();
  const firstWord = title ? title.split(" ")[0] : "";
  const restOfTitle = title ? title.split(" ").slice(1).join(" ") : "";

  // Spline power management: force the scene background to true black at runtime
  // (no re-export needed), and park the whole WebGL loop when the tab is hidden —
  // a login left open on a shop tablet must idle cold, not at full rAF.
  const splineApp = React.useRef(null);
  const onSplineLoad = React.useCallback((app) => {
    splineApp.current = app;
    try { app.setBackgroundColor("#000000"); } catch { /* older runtime — scene is near-black anyway */ }
    if (document.hidden) { try { app.stop(); } catch { /* ok */ } }
  }, []);
  React.useEffect(() => {
    const onVis = () => {
      const app = splineApp.current;
      if (!app) return;
      try { document.hidden ? app.stop() : app.play(); } catch { /* ok */ }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const reveal = REDUCED
    ? {}
    : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: dur.hero, ease: ease.emphasis } };
  const revealCard = REDUCED
    ? {}
    : { initial: { opacity: 0, y: 20, scale: 0.985 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: dur.hero, ease: ease.emphasis, delay: 0.08 } };

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-black text-ink">
      {/* 1 · optional ambient 3D layer (unwired — robot owns the black void) */}
      <div className="absolute inset-0 z-[1]">{scene}</div>

      {/* 2 · spotlight beam */}
      <Spotlight className="-top-40 -left-20 md:left-0 z-[2]" fill="white" />

      {/* 3 · split content — LEFT robot showcase · RIGHT sign-in. One viewport. */}
      <div className="relative z-10 grid min-h-[100dvh] grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        {/* LEFT — interactive Spline robot + holographic overlays */}
        <m.div {...reveal} className="relative hidden lg:block">
          {/* the robot tracks the cursor — needs pointer events, so every overlay
              above it is pointer-events-none */}
          {!REDUCED && !LOW_POWER && isDesktop && (
            <SplineErrorBoundary>
              <div className="absolute inset-0">
                <SplineScene scene={SPLINE_SCENE} className="w-full h-full" onLoad={onSplineLoad} />
              </div>
            </SplineErrorBoundary>
          )}

          {/* holographic scan-lines + a slow travelling scan band */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 3px)",
              }}
            />
            <div
              className="absolute inset-x-0 top-0 h-40 motion-safe:[animation:scan-sweep_7s_linear_infinite]"
              style={{ background: "linear-gradient(to bottom, transparent, rgba(170,220,255,0.07), transparent)" }}
            />
          </div>

          {/* brand + boot sequence, floating above the robot */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-12 xl:p-16">
            <div>
              {date && (
                <p className="font-mono text-[11px] uppercase tracking-[0.34em] text-ink-soft/90 flex items-center gap-3">
                  <span className="h-px w-8 bg-ink-soft/40" aria-hidden="true" />
                  {date}
                </p>
              )}
              <BootSequence />
            </div>
            <div>
              <h1 className="font-display text-6xl xl:text-7xl font-extrabold tracking-[-0.045em] leading-[0.88] [text-shadow:0_4px_44px_rgba(0,0,0,0.7)]">
                {firstWord}
              </h1>
              <h1 className="font-display text-6xl xl:text-7xl font-extrabold tracking-[-0.045em] leading-[0.88] text-ink-soft [text-shadow:0_4px_44px_rgba(0,0,0,0.7)]">
                {restOfTitle}
              </h1>
              <p className="mt-5 max-w-sm text-ink-soft text-sm leading-relaxed [text-shadow:0_2px_18px_rgba(0,0,0,0.8)]">
                Daily production planning &amp; Plan-vs-Actual tracking for the CNC floor.
              </p>
            </div>
          </div>
        </m.div>

        {/* RIGHT — sign-in on a frosted panel with a cursor-following sheen */}
        <m.div
          {...revealCard}
          className="relative flex items-center justify-center px-6 py-10 sm:px-10 min-h-[100dvh] lg:min-h-0 lg:border-l lg:border-hair lg:bg-base/45 lg:backdrop-blur-xl"
        >
          {!REDUCED && <CursorSpotlight size={340} />}
          {children}
        </m.div>
      </div>
    </div>
  );
}
