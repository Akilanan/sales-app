import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { m, AnimatePresence, useMotionValue, useTransform, useSpring, animate } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area, ReferenceLine, LabelList,
} from "recharts";
import {
  SquaresFour as LayoutDashboard, ClipboardText as ClipboardList,
  SlidersHorizontal as Settings2, Plus, Trash as Trash2, Check, SignOut as LogOut, X,
  TrendUp as TrendingUp, TrendDown as TrendingDown, Clock, ArrowRight,
  Warning as AlertTriangle, ShieldCheck, Backspace as Delete, Minus,
} from "@phosphor-icons/react";
import { db, seedIfEmpty, MODE, CONFIG_ERROR } from "./lib/db";

/* ============================================================================
   PRANA VENTURE — "COLD STEEL" UI · arctic graphite, ONE solid electric-blue
   accent (no glow), matte studio-lit 3D, crosshair precision marks, mono data.
   Drawn from igloo (steel monochrome + atmosphere) and lusion (Klein-blue +
   matte 3D + crosshair). Colour reserved for the blue brand + production STATUS
   (green/amber/red, always with a label + icon). Same data layer.
============================================================================ */

const Ambient = lazy(() => import("./lib/Ambient"));
const REDUCED = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Low-power devices (shop-floor tablets) get a lightweight static glow, not WebGL.
const LOW_POWER = typeof navigator !== "undefined" && (
  (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) ||
  (navigator.connection && navigator.connection.saveData === true) // metered/data-saver tablet → skip 3D entirely
);
// Probe actual WebGL support — deviceMemory is undefined on iOS Safari, so the
// heuristic above can't be trusted alone. No context → static fallback.
function webglSupported() {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
const NO_WEBGL = !webglSupported();

// If the 3D scene throws at runtime, fall back to the static glow instead of a
// blank/broken panel.
class SceneBoundary extends React.Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <StaticGlow variant="hero" /> : this.props.children; }
}

// Cool, single-source static fallback — never the blotchy multi-radial blob.
function StaticGlow({ variant = "ambient" }) {
  const bg = variant === "hero"
    ? "radial-gradient(58% 52% at 66% 32%, rgba(94,231,255,0.14), transparent 70%), radial-gradient(48% 44% at 14% 98%, rgba(120,138,180,0.06), transparent 72%)"
    : "radial-gradient(46% 42% at 84% 18%, rgba(94,231,255,0.08), transparent 72%)";
  return <div className={`${variant === "hero" ? "absolute" : "fixed"} inset-0 pointer-events-none`} style={{ zIndex: 0, background: bg }} aria-hidden="true" />;
}

// Live prefers-reduced-motion — re-renders into the static fallback the instant
// the OS setting flips (not a one-shot read at module load).
function useReducedMotion() {
  const [reduced, setReduced] = useState(REDUCED);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

// Live cinematic 3D is reserved for the login hero (fast work screens by design).
function LoginScene() {
  const reduced = useReducedMotion();
  if (reduced || LOW_POWER || NO_WEBGL) return <StaticGlow variant="hero" />;
  return (
    <SceneBoundary>
      <Suspense fallback={<StaticGlow variant="hero" />}><Ambient variant="hero" /></Suspense>
    </SceneBoundary>
  );
}

const SHIFTS = [
  { id: 1, label: "Shift 1", time: "06:00 – 14:00" },
  { id: 2, label: "Shift 2", time: "14:00 – 22:00" },
  { id: 3, label: "Shift 3", time: "22:00 – 06:00" },
];
// LOCAL date (en-CA gives YYYY-MM-DD) — NOT toISOString() which is UTC and would
// record the wrong shift date near midnight in the shop floor's timezone.
const todayStr = () => new Date().toLocaleDateString("en-CA");
const curMonth = () => todayStr().slice(0, 7);
const prettyMonth = (m) => { const [y, mo] = m.split("-"); return new Date(y, mo - 1).toLocaleString("en", { month: "long", year: "numeric" }); };

const STATUS = {
  ok: { label: "On Track", text: "text-ok-ink", soft: "bg-ok-soft", solid: "bg-ok", hex: "#3FB969", Icon: TrendingUp },
  warn: { label: "Behind", text: "text-warn-ink", soft: "bg-warn-soft", solid: "bg-warn", hex: "#E0A53C", Icon: AlertTriangle },
  bad: { label: "Critical", text: "text-bad-ink", soft: "bg-bad-soft", solid: "bg-bad", hex: "#F1564C", Icon: TrendingDown },
};
const levelForPct = (p) => (p >= 100 ? "ok" : p >= 80 ? "warn" : "bad");
const levelForPace = (pace) => (pace >= 0.97 ? "ok" : pace >= 0.85 ? "warn" : "bad");
const HEX = { brand: "#5EE7FF", grid: "rgba(120,180,200,0.08)", ghost: "rgba(120,180,200,0.14)", axis: "#6B7682", axis2: "#A1A1AA" };
// Bespoke chart tooltip — a matte spec-card with a brand left-rule echoing the
// dashboard status rail. No drop shadow (the system is flat, not floating-glass).
function ChartTip({ active, payload, label, unit = "units" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-coal border border-hair rounded-[8px] px-3 py-2.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim mb-1.5">{label}</div>
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-[2px]" style={{ background: p.color || p.stroke || p.fill || HEX.brand }} />
            <span className="text-ink-soft">{p.name}</span>
            <span className="ml-auto pl-4 font-mono font-bold text-ink tnum">{Number(p.value).toLocaleString()} {unit}</span>
          </div>
        ))}
      </div>
      {(() => {
        const plan = payload.find((p) => p.name === "Plan")?.value;
        const actual = payload.find((p) => p.name === "Actual")?.value;
        if (plan == null || actual == null) return null;
        const d = actual - plan;
        const pct = plan ? Math.round((actual / plan) * 100) : 0;
        return (
          <div className={`flex items-center gap-3 text-xs mt-1.5 pt-1.5 border-t border-hair ${STATUS[levelForPct(pct)].text}`}>
            <span className="font-mono uppercase text-[10px] tracking-wider text-ink-dim">Δ vs plan</span>
            <span className="ml-auto font-mono font-bold tnum">{d > 0 ? "+" : d < 0 ? "−" : ""}{Math.abs(d).toLocaleString()} · {pct}%</span>
          </div>
        );
      })()}
    </div>
  );
}

const PANEL = "bg-panel border border-hair shadow-card";
// Hero surfaces (glance banner, top chart panels): a faint top-edge luminance
// gradient + brighter top hairline so the upper edge catches light — the fix for
// "reads flat/dark at top". Used sparingly (overuse = template tell).
const PANEL_HERO = "bg-gradient-to-b from-panelhi to-panel border border-hair shadow-hero";
// Pointer-follow spotlight: writes the cursor's local x/y into CSS vars on the
// card (no React re-render). Pair with the `spotlight` class; the glow itself is
// CSS-gated to fine-pointer desktops, so shop-floor touch tablets never paint it.
const spotlightMove = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
};
const containerV = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const itemV = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };

// Count-up via MotionValue — animates without re-rendering (no stagger conflict).
function AnimatedNumber({ value }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const controls = animate(mv, Number(value) || 0, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value]);
  return <m.span>{text}</m.span>;
}

// Brand is carried by the Archivo wordmark — no symbol/gem (those read AI).
const Wordmark = ({ size = "sm" }) => (
  <div>
    <div className={`font-display font-bold tracking-[0.015em] leading-none ${size === "lg" ? "text-lg" : "text-[15px]"}`}>
      PRANA <span className="text-ink-dim font-semibold">VENTURE</span>
    </div>
    <div className="font-mono text-ink-dim text-[10px] tracking-[0.22em] uppercase mt-1.5">Production Console</div>
  </div>
);

// Crosshair registration marks — lusion's precision motif. Tasteful, sparse.
const Crosshair = ({ className = "" }) => (
  <svg width="13" height="13" viewBox="0 0 13 13" className={`text-ink-dim/60 ${className}`} fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
    <path d="M6.5 0 V13 M0 6.5 H13" />
  </svg>
);

// Mono technical eyebrow / annotation.
const Eyebrow = ({ children, className = "" }) => (
  <div className={`font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft ${className}`}>{children}</div>
);

// Magnetic wrapper — the body drifts toward the cursor, springs back. Desktop +
// fine-pointer ONLY (gated), so shop-floor touch tablets never see it.
function Magnetic({ children, strength = 0.3, className = "" }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const sy = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });
  const on = useRef(false);
  useEffect(() => {
    on.current = typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);
  const move = (e) => {
    if (!on.current || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => { x.set(0); y.set(0); };
  return (
    <m.div ref={ref} onMouseMove={move} onMouseLeave={reset} style={{ x: sx, y: sy }} className={className}>
      {children}
    </m.div>
  );
}

// Per-letter staggered reveal (one-shot on mount). aria-label carries the real
// text; the animated letters are aria-hidden. Falls back to static under reduced-motion.
function SplitReveal({ lines, className = "" }) {
  const reduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return <span className={className}>{lines.map((l, i) => <span key={i} className="block">{l}</span>)}</span>;
  const container = { hidden: {}, show: { transition: { staggerChildren: 0.035, delayChildren: 0.12 } } };
  const letter = { hidden: { y: "0.5em", opacity: 0, filter: "blur(6px)" }, show: { y: 0, opacity: 1, filter: "blur(0px)", transition: { type: "spring", stiffness: 300, damping: 24 } } };
  return (
    <m.span variants={container} initial="hidden" animate="show" aria-hidden="true" className={className}>
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.split("").map((ch, i) => (
            <m.span key={i} variants={letter} className="inline-block whitespace-pre">{ch}</m.span>
          ))}
        </span>
      ))}
    </m.span>
  );
}

function StatusPill({ level, label, size = "md" }) {
  const s = STATUS[level];
  const p = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-[12px]";
  return <span className={`inline-flex items-center rounded-[6px] font-semibold ${p} ${s.soft} ${s.text}`}>{label || s.label}</span>;
}

// Signed variance vs target — the magnitude behind the status word (±units · ±%).
function VarianceChip({ delta, pct, level }) {
  const s = STATUS[level];
  const d = Math.round(delta);
  return (
    <span className={`inline-flex items-center font-mono text-[12px] font-semibold rounded-[6px] px-2 py-0.5 tnum ${s.soft} ${s.text}`}>
      {d > 0 ? "+" : d < 0 ? "−" : ""}{Math.abs(d).toLocaleString()} · {pct > 0 ? "+" : pct < 0 ? "−" : ""}{Math.abs(pct)}%
    </span>
  );
}
// Bar fill: neutral steel when on-plan, colour ONLY for misses (HPHMI: colour = exception).
const barFill = (pct) => (pct >= 100 ? "#5C6573" : STATUS[levelForPct(pct)].hex);

// Rounded-rect SVG path with per-corner radii — lets the diverging deviation bars
// round only the outer tip while staying square against the zero rail.
function roundRectPath(x, y, w, h, tl, tr, br, bl) {
  return `M${x + tl},${y} h${w - tl - tr} a${tr},${tr} 0 0 1 ${tr},${tr} v${h - tr - br} a${br},${br} 0 0 1 ${-br},${br} h${-(w - br - bl)} a${bl},${bl} 0 0 1 ${-bl},${-bl} v${-(h - bl - tl)} a${tl},${tl} 0 0 1 ${tl},${-tl} z`;
}

// Chart 01 — diverging deviation bar. Behind plan = a coloured bar extending LEFT
// of the zero rail; on/ahead = neutral steel to the right. Outer tip rounded only.
function DevBar(props) {
  const { x, y, width, height, payload } = props;
  if (!width || !payload) return null;
  const neg = payload.dev < 0;
  const r = Math.min(5, Math.abs(width), height / 2);
  const id = payload.pct >= 100 ? "dev-steel" : `dev-${levelForPct(payload.pct)}`;
  const d = neg
    ? roundRectPath(x, y, width, height, r, 0, 0, r)   // round the left tip (behind → extends left)
    : roundRectPath(x, y, width, height, 0, r, r, 0);  // round the right tip (ahead → extends right)
  return <path d={d} fill={`url(#${id})`} />;
}

// Mono delta label at the bar tip — ONLY on misses (colour = exception, so an
// on-plan row stays clean and the eye lands on the problems).
function makeDevLabel(data) {
  return function DevLabel({ x, y, width, height, index }) {
    const d = data[index];
    if (!d || d.pct >= 100) return null;        // misses only — they extend left of the rail
    return (                                     // label sits in the empty right half, never clipping
      <text x={x + width + 9} y={y + height / 2} textAnchor="start" dominantBaseline="central"
        fontFamily="'IBM Plex Mono', ui-monospace, monospace" fontSize="10.5" fontWeight="600"
        fill={STATUS[levelForPct(d.pct)].hex}>
        {d.dev > 0 ? "+" : "−"}{Math.abs(d.dev).toLocaleString()} · {d.pct}%
      </text>
    );
  };
}

// Live "now" dot for the daily-output trend — a quiet brand point with a slow
// SMIL pulse ring (reduced-motion drops the ring). Renders on the final day only.
function PulseDot({ cx, cy, index, dataLen }) {
  if (cx == null || index !== dataLen - 1) return null;
  return (
    <g>
      {!REDUCED && (
        <circle cx={cx} cy={cy} r="4" fill="none" stroke={HEX.brand} strokeOpacity="0.55">
          <animate attributeName="r" values="4;12" dur="1.9s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.55;0" dur="1.9s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={cx} cy={cy} r="3.5" fill={HEX.brand} stroke="#020203" strokeWidth="2" />
    </g>
  );
}

// Tooltip for the deviation bar — one row carries Actual / Target / Δ-vs-plan,
// matching the ChartTip spec-card so the two charts read as one system.
function CompTip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const cl = levelForPct(d.pct);
  return (
    <div className="bg-coal border border-hair rounded-[8px] px-3 py-2.5 min-w-[156px]">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim mb-1.5">{d.name}</div>
      <div className="flex items-center justify-between gap-5 text-xs"><span className="text-ink-soft">Actual</span><span className="font-mono font-bold text-ink tnum">{d.actual.toLocaleString()}</span></div>
      <div className="flex items-center justify-between gap-5 text-xs mt-0.5"><span className="text-ink-soft">Expected</span><span className="font-mono text-ink-soft tnum">{d.expected.toLocaleString()}</span></div>
      <div className="flex items-center justify-between gap-5 text-[10px] mt-0.5"><span className="text-ink-dim">Month plan</span><span className="font-mono text-ink-dim tnum">{d.target.toLocaleString()}</span></div>
      <div className={`flex items-center justify-between gap-5 text-xs mt-1.5 pt-1.5 border-t border-hair ${STATUS[cl].text}`}>
        <span className="font-mono uppercase text-[10px] tracking-wider text-ink-dim">Δ vs pace</span>
        <span className="font-mono font-bold tnum">{d.dev > 0 ? "+" : d.dev < 0 ? "−" : ""}{Math.abs(d.dev).toLocaleString()} · {d.pct}%</span>
      </div>
    </div>
  );
}

/* ============================================================================ */
// PROD SAFETY screen — shown when a production build has no Supabase config, so the
// app never silently serves demo data to real users.
function ConfigError() {
  return (
    <div className="min-h-[100dvh] grid place-items-center px-6 relative overflow-hidden">
      <StaticGlow />
      <div className="relative z-10 w-full max-w-md text-center">
        <div className="font-display font-extrabold text-[26px] tracking-tight leading-none mb-1">PRANA <span className="text-ink-dim font-bold">VENTURE</span></div>
        <div className="inline-flex items-center gap-2 mt-5 mb-3 px-3 py-1.5 rounded-lg bg-bad-soft border border-bad/25 text-bad-ink font-mono text-[11px] uppercase tracking-[0.18em]"><AlertTriangle size={14} /> Configuration required</div>
        <h1 className="font-display font-bold text-xl text-ink mb-3">This build is not connected to a database</h1>
        <p className="text-ink-soft text-sm leading-relaxed">
          A production build will not run in demo mode. Set <code className="font-mono text-ink">VITE_SUPABASE_URL</code> and <code className="font-mono text-ink">VITE_SUPABASE_ANON_KEY</code> in the deploy environment, then rebuild.
        </p>
        <p className="text-ink-dim text-[12px] mt-5 font-mono">For a local demo, run <span className="text-ink-soft">npm run dev</span>.</p>
      </div>
    </div>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [data, setData] = useState({ components: [], machines: [], plans: [], entries: [] });
  const [live, setLive] = useState(false); // realtime connection state (supabase mode)

  const appStatus = useMemo(() => {
    const totalMonthly = data.plans.reduce((s, p) => s + p.target_qty, 0);
    const dailyTargetTotal = data.plans.reduce((s, p) => s + p.target_qty / p.working_days, 0);
    const actualMonthly = data.entries.reduce((s, e) => s + e.quantity, 0);
    const expectedSoFar = Math.min(dailyTargetTotal * new Date().getDate(), totalMonthly);
    const pace = expectedSoFar ? actualMonthly / expectedSoFar : 1;
    return pace >= 0.97 ? "ok" : pace >= 0.85 ? "warn" : "bad";
  }, [data]);

  useEffect(() => { (async () => { if (CONFIG_ERROR) { setBooting(false); return; } await seedIfEmpty(); setBooting(false); })(); }, []);

  const loadData = useCallback(async () => {
    const [components, machines] = await Promise.all([db.listComponents(), db.listMachines()]);
    const [plans, entries] = await Promise.all([db.getPlans(curMonth()), db.listEntries({ month: curMonth() })]);
    setData({ components, machines, plans, entries });
  }, []);

  const onLogin = async (u) => { setUser(u); setView(u.role === "operator" ? "entry" : "dashboard"); await loadData(); };
  const logout = async () => { try { await db.signOut(); } catch { /* ignore */ } setUser(null); setView("dashboard"); };

  // LIVE SYNC — once signed in, refresh (debounced) whenever anyone logs output
  // or changes a plan/component on any device. RLS keeps each client's data
  // scoped; the reload is RLS-scoped too. No-op in local/demo mode.
  useEffect(() => {
    if (!user) { setLive(false); return; }
    let t;
    const unsub = db.subscribe(
      () => { clearTimeout(t); t = setTimeout(loadData, 350); },
      (connected) => setLive(connected)
    );
    return () => { clearTimeout(t); setLive(false); unsub(); };
  }, [user, loadData]);

  // PROD SAFETY: never silently serve demo data in a production build that has no
  // Supabase config. Refuse to mount; show a hard, unmistakable configuration error.
  if (CONFIG_ERROR) return <ConfigError />;

  if (booting)
    return (
      <div className="min-h-[100dvh] grid place-items-center relative overflow-hidden">
        <StaticGlow />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="font-display font-extrabold text-[28px] tracking-tight leading-none">PRANA <span className="text-ink-dim font-bold">VENTURE</span></div>
            <div className="font-mono text-ink-dim text-[10px] tracking-[0.3em] uppercase mt-2.5">Production Console</div>
          </div>
          <div className="w-44"><Meter pct={100} height="h-1" ticks /></div>
          <Eyebrow className="!tracking-[0.32em]">Initialising</Eyebrow>
        </div>
      </div>
    );
  // Cinematic threshold: login blur-fades out, the app fades in, and the PRANA
  // wordmark (shared layoutId) flies from the login lockup into the header nav.
  return (
    <AnimatePresence mode="wait">
      {!user ? (
        <m.div key="login" exit={{ opacity: 0, filter: "blur(8px)" }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
          <LoginScreen onLogin={onLogin} />
        </m.div>
      ) : (
        <m.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="min-h-[100dvh] text-ink relative">
          <Sidebar user={user} view={view} setView={setView} logout={logout} status={appStatus} live={live} />
          <div className="pl-[68px] lg:pl-[240px] transition-[padding] duration-200">
            <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
              <AnimatePresence mode="wait">
                <m.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}>
                  {view === "dashboard" && <Dashboard data={data} live={live} setView={setView} />}
                  {view === "entry" && <ShiftEntry data={data} user={user} reload={loadData} />}
                  {view === "plan" && <PlanSetup data={data} reload={loadData} />}
                </m.div>
              </AnimatePresence>
            </main>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------ Login ------------------------------------- */
// A "production heartbeat" — output cadence drawn once on mount with a live
// trailing pulse. A bespoke mark a generated layout never has.
function Heartbeat() {
  const d = "M0 26 H86 l8 -15 l10 28 l9 -34 l10 40 l8 -19 H148 l7 -10 l9 20 l8 -10 H300";
  return (
    <svg viewBox="0 0 300 52" className="w-full max-w-[300px] h-10 text-brand-400" fill="none" preserveAspectRatio="none" aria-hidden="true">
      <m.path d={d} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.9 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.35 }} />
      <m.circle r="2.6" fill="currentColor"
        initial={{ cx: 0, cy: 26, opacity: 0 }} animate={{ cx: 300, opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3.2, ease: "linear", delay: 1.9, repeat: Infinity, repeatDelay: 1.4 }} />
    </svg>
  );
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("operator");
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [pending, setPending] = useState(false); // async auth in flight → block double-submit

  const press = (d) => { if (pending) return; setErr(""); setPin((p) => (p.length < 6 ? p + d : p)); };
  const back = () => { if (!pending) setPin((p) => p.slice(0, -1)); };
  const pinLogin = async () => {
    if (pending || pin.length === 0) return;
    setPending(true);
    try { const u = await db.loginByPin(pin); if (u) { onLogin(u); } else { setErr("Invalid PIN. Try 1001, 1002 or 1003."); setPin(""); } }
    catch { setErr("Sign-in failed. Please try again."); }
    finally { setPending(false); }
  };
  const credLogin = async () => {
    if (pending) return;
    setPending(true);
    try { const u = await db.loginByCredentials(username, password); if (u) { onLogin(u); } else { setErr("Wrong username or password."); } }
    catch { setErr("Sign-in failed. Please try again."); }
    finally { setPending(false); }
  };

  // Solid keys — flat fills, hairline borders, tactile press. No glass, no glow.
  const Key = ({ children, onClick, variant, label, disabled }) => (
    <m.button onClick={onClick} disabled={disabled} aria-label={label}
      whileTap={disabled ? undefined : { scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 25, mass: 0.6 }}
      className={`h-16 rounded-xl grid place-items-center text-2xl font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none ${
        variant === "go" ? "bg-brand-500 text-[#04161a] hover:bg-brand-600 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]"
        : variant === "back" ? "bg-inset border border-hair text-ink-soft hover:text-ink hover:border-white/15"
        : "bg-inset border border-hair text-ink font-mono hover:border-brand-500/55 hover:bg-white/[0.04]"}`}>{children}</m.button>
  );

  const modes = [["operator", "Operator"], ["manager", "Manager"]];

  return (
    <main className="min-h-[100dvh] w-full text-ink lg:grid lg:grid-cols-[1.12fr_minmax(400px,42%)]">
      {/* LEFT — full-bleed matte 3D + minimal hero copy (desktop only).
          Decluttered: one headline owns the frame, the lit part floats upper-right. */}
      <section className="relative hidden lg:flex flex-col justify-end overflow-hidden px-12 xl:px-16 py-14 border-r border-hair">
        <LoginScene />
        {/* scrim: darken lower-left for legible copy, leave the upper-right object clear */}
        <div className="absolute inset-0 z-[1] pointer-events-none" style={{ background: "radial-gradient(82% 82% at 0% 100%, rgba(11,13,18,0.92) 0%, rgba(11,13,18,0.28) 46%, rgba(11,13,18,0) 66%), linear-gradient(90deg, rgba(11,13,18,0.6) 0%, rgba(11,13,18,0) 42%)" }} />
        {/* cinematic CSS grade — soft blue bloom behind the part + edge vignette (zero WebGL cost) */}
        <div className="absolute inset-0 z-[2] pointer-events-none" style={{ background: "radial-gradient(44% 42% at 68% 36%, rgba(94,231,255,0.11), transparent 68%), radial-gradient(125% 120% at 52% 42%, transparent 58%, rgba(4,6,11,0.6) 100%)" }} />
        {/* crosshair registration marks */}
        <Crosshair className="absolute z-[2] top-10 right-10" />
        <Crosshair className="absolute z-[2] top-10 left-12" />
        <Crosshair className="absolute z-[2] bottom-10 right-1/3" />

        <div className="relative z-10 max-w-md pb-1">
          <h1 className="font-display text-[clamp(2.4rem,4.2vw,3.6rem)] font-extrabold leading-[1.0] tracking-[-0.03em]" aria-label="Built on the shop floor.">
            <SplitReveal lines={["Built on the", "shop floor."]} />
          </h1>
          <p className="mt-6 text-ink-soft text-[15px] leading-relaxed max-w-sm">
            Operators log output after every shift. Plan-versus-actual updates in real time, on any tablet on the line.
          </p>
          <div className="mt-8"><Heartbeat /></div>
        </div>
      </section>

      {/* RIGHT — solid form panel (subtle top-down depth to match the cards) */}
      <section className="relative flex items-center justify-center px-6 py-10 sm:px-10 bg-gradient-to-b from-[#121620] to-coal min-h-[100dvh]">
        <m.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-[360px]">
          {/* brand lockup */}
          <m.div className="mb-8">
            <Wordmark />
          </m.div>

          <div className="mb-7">
            <Eyebrow className="mb-3">Sign in</Eyebrow>
            <h2 className="font-display text-[28px] font-extrabold tracking-[-0.01em] leading-none">Access the console</h2>
            <p className="text-ink-soft text-sm mt-2.5">Operators use a PIN · managers use a password.</p>
          </div>

          {/* segmented toggle — sliding indicator */}
          <div className="relative grid grid-cols-2 p-1 rounded-xl bg-inset border border-hair mb-6">
            <m.div className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-brand-500"
              animate={{ x: mode === "operator" ? 0 : "100%" }} transition={{ type: "spring", stiffness: 380, damping: 32 }} />
            {modes.map(([id, label]) => (
              <button key={id} onClick={() => { setMode(id); setErr(""); }} aria-pressed={mode === id} className={`relative z-10 min-h-[44px] py-3 rounded-lg text-sm font-semibold transition-colors ${mode === id ? "text-[#04161a]" : "text-ink-soft hover:text-ink"}`}>{label}</button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {mode === "operator" ? (
              <m.div key="op" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.22 }}>
                <div className={labelCls}>PIN</div>
                <div role="status" aria-live="polite" aria-label={pin.length ? `${pin.length} digit${pin.length === 1 ? "" : "s"} entered` : "PIN empty"} className="h-14 mb-4 rounded-xl bg-inset border border-hair flex items-center justify-center gap-3">
                  {pin.length === 0 ? <span className="font-mono text-ink-dim text-[11px] uppercase tracking-[0.28em]">Enter PIN</span> :
                    pin.split("").map((_, i) => <m.span key={i} initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 28 }} className="w-3 h-3 rounded-full bg-brand-400" />)}
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <Key key={n} onClick={() => press(String(n))}>{n}</Key>)}
                  <Key onClick={back} variant="back" label="Delete last digit"><Delete size={22} /></Key>
                  <Key onClick={() => press("0")}>0</Key>
                  <Key onClick={pinLogin} variant="go" label="Enter PIN" disabled={pending || pin.length === 0}><ArrowRight size={24} /></Key>
                </div>
              </m.div>
            ) : (
              <m.div key="mgr" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.22 }}>
                <form onSubmit={(e) => { e.preventDefault(); credLogin(); }} className="space-y-4">
                  <div>
                    <label htmlFor="login-username" className={labelCls}>Username</label>
                    <input id="login-username" name="username" autoComplete="username" value={username} onChange={(e) => { setUsername(e.target.value); setErr(""); }} placeholder="anita / admin" className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="login-password" className={labelCls}>Password</label>
                    <input id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setErr(""); }} placeholder="••••••••" className={inputCls} />
                  </div>
                  <Magnetic className="w-full"><button type="submit" disabled={pending} className="group w-full py-3.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-[#04161a] font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22)] disabled:opacity-60 disabled:cursor-not-allowed">{pending ? "Signing in…" : <>Log in <ArrowRight size={18} className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1" /></>}</button></Magnetic>
                </form>
              </m.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {err && <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div role="alert" className={`${errCls} mt-4`}><AlertTriangle size={15} className="shrink-0" />{err}</div></m.div>}
          </AnimatePresence>

          {MODE === "local" && (
            <div className="mt-7 pt-5 border-t border-hair text-center font-mono text-[11px] text-ink-dim leading-relaxed tracking-wide">
              DEMO ACCESS · PIN <span className="text-ink-soft">1001</span> · MANAGER <span className="text-ink-soft">admin / admin123</span>
            </div>
          )}
        </m.div>
      </section>
    </main>
  );
}

/* ------------------------------ Sidebar ----------------------------------- */
// Command-deck left rail (Linear/Vercel/Notion pattern, the strongest dashboard nav).
// Full 240px on desktop, a 68px icon rail on tablet/mobile (labels hidden, always
// reachable). Active = cyan bg-tint + a 2px cyan accent bar + cyan text + filled icon.
function Sidebar({ user, view, setView, logout, status, live }) {
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["supervisor", "admin"] },
    { id: "entry", label: "Shift Entry", icon: ClipboardList, roles: ["operator", "supervisor", "admin"] },
    { id: "plan", label: "Plan Setup", icon: Settings2, roles: ["supervisor", "admin"] },
  ].filter((t) => t.roles.includes(user.role));
  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex flex-col w-[68px] lg:w-[240px] bg-coal border-r border-hair transition-[width] duration-200">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/45 to-transparent" aria-hidden="true" />
      {/* brand — compact mark on the rail, full wordmark on desktop */}
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-5 border-b border-hair shrink-0">
        <span className="lg:hidden font-display font-extrabold text-[19px] text-ink tracking-tight">P</span>
        <div className="hidden lg:block"><Wordmark /></div>
      </div>
      {/* nav */}
      <nav aria-label="Primary" className="flex-1 py-4 px-2 lg:px-3 space-y-1 overflow-y-auto">
        {tabs.map((t) => {
          const a = view === t.id;
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setView(t.id)} aria-current={a ? "page" : undefined} title={t.label}
              className={`relative w-full flex items-center justify-center lg:justify-start gap-3 min-h-[48px] px-0 lg:px-3 rounded-lg text-sm font-semibold transition ${a ? "bg-brand-500/[0.10] text-brand-200" : "text-ink-soft hover:text-ink hover:bg-white/[0.04]"}`}>
              {a && <m.span layoutId="navrail" className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-brand-500" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
              <Icon size={20} weight={a ? "fill" : "bold"} className="shrink-0" />
              <span className="hidden lg:block">{t.label}</span>
            </button>
          );
        })}
      </nav>
      {/* footer — live status, user, logout */}
      <div className="border-t border-hair p-3 shrink-0 space-y-2.5">
        {live && (
          <div className="flex items-center justify-center lg:justify-start gap-2 lg:px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ok-ink" title="Live — data updates in real time across devices">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full rounded-full bg-ok opacity-75 motion-safe:animate-ping" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-ok" /></span>
            <span className="hidden lg:block">Live</span>
          </div>
        )}
        <div className="flex items-center justify-center lg:justify-between gap-2">
          <div className="hidden lg:block min-w-0 font-semibold text-sm text-ink-soft truncate">{user.name}</div>
          <button onClick={logout} title="Log out" aria-label="Log out" className="p-2.5 min-h-[44px] min-w-[44px] grid place-items-center rounded-lg text-ink-dim hover:bg-white/[0.06] hover:text-bad-ink transition shrink-0"><LogOut size={18} /></button>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------ Dashboard --------------------------------- */
function Dashboard({ data, live }) {
  const { components, plans, entries } = data;
  const planFor = (cid) => plans.find((p) => p.component_id === cid);

  const totalMonthly = plans.reduce((s, p) => s + p.target_qty, 0);
  const dailyTargetTotal = plans.reduce((s, p) => s + p.target_qty / p.working_days, 0);
  const actualMonthly = entries.reduce((s, e) => s + e.quantity, 0);
  const today = todayStr();
  const todayEntries = entries.filter((e) => e.production_date === today);
  const actualToday = todayEntries.reduce((s, e) => s + e.quantity, 0);
  const scrapMonthly = entries.reduce((s, e) => s + (e.scrap_qty || 0), 0);
  const monthlyPct = totalMonthly ? Math.round((actualMonthly / totalMonthly) * 100) : 0;
  const dailyPct = dailyTargetTotal ? Math.round((actualToday / dailyTargetTotal) * 100) : 0;

  const dayOfMonth = new Date().getDate();
  // pace vs WORKING days elapsed (exclude Sundays) — calendar days over-count the target.
  const now = new Date();
  let workingDaysElapsed = 0;
  for (let d = 1; d <= dayOfMonth; d++) { if (new Date(now.getFullYear(), now.getMonth(), d).getDay() !== 0) workingDaysElapsed++; }
  const expectedSoFar = Math.min(dailyTargetTotal * workingDaysElapsed, totalMonthly);
  const pace = expectedSoFar ? actualMonthly / expectedSoFar : 1;
  const lvl = levelForPace(pace);
  const paceText = lvl === "ok" ? "On track to hit the monthly plan" : lvl === "warn" ? "Slightly behind the expected pace" : "Behind the expected pace — needs attention";
  const paceDelta = actualMonthly - expectedSoFar;
  const pacePct = expectedSoFar ? Math.round((actualMonthly / expectedSoFar - 1) * 100) : 0;

  const compData = components.map((c) => {
    const p = planFor(c.id); const target = p ? p.target_qty : 0;
    const wd = p ? p.working_days : 0;
    const cEntries = entries.filter((e) => e.component_id === c.id);
    const actual = cEntries.reduce((s, e) => s + e.quantity, 0);
    const cByDay = {};
    cEntries.forEach((e) => { cByDay[e.production_date] = (cByDay[e.production_date] || 0) + e.quantity; });
    const spark = Object.keys(cByDay).sort().map((d) => ({ v: cByDay[d] }));
    // Compare against the PRORATED target (expected by today), not the full month —
    // mid-month, actual-vs-full-target paints everything critical-red and tells you nothing.
    const expected = wd ? Math.min(target, Math.round((target / wd) * workingDaysElapsed)) : 0;
    const pct = expected ? Math.round((actual / expected) * 100) : (actual > 0 ? 100 : 0);
    return { name: c.name, target, expected, actual, pct, dev: actual - expected, spark };
  }).filter((d) => d.target > 0 || d.actual > 0).sort((a, b) => a.pct - b.pct); // worst-first: problems surface at the top
  const maxDev = Math.max(...compData.map((d) => Math.abs(d.dev)), 1); // symmetric domain for the diverging bars

  const byDay = {};
  entries.forEach((e) => { byDay[e.production_date] = (byDay[e.production_date] || 0) + e.quantity; });
  const trend = Object.keys(byDay).sort().map((d) => ({ day: d.slice(8), actual: byDay[d] }));
  // daily-output split: above the daily target reads OK-green, below reads amber.
  // Done as a domain-fraction gradient stop (no pixel-scale plumbing needed).
  const dailyTargetRounded = Math.round(dailyTargetTotal);
  const trendMax = Math.max(...trend.map((t) => t.actual), dailyTargetRounded, 1);
  const trendDomainMax = Math.max(Math.ceil(trendMax * 1.12), 1);
  const splitOff = Math.max(0, Math.min(1, 1 - dailyTargetRounded / trendDomainMax));
  const shiftData = SHIFTS.map((s) => ({ ...s, qty: todayEntries.filter((e) => e.shift === s.id).reduce((sum, e) => sum + e.quantity, 0) }));

  // KPI strip metrics — a balanced 4-tile row, each a DIFFERENT cut so it never
  // repeats the glance banner's monthly number (the old "Produced MTD" tile did).
  const sparkDaily = trend.map((t) => ({ v: t.actual }));               // daily output, for the avg-tile sparkline
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let totalWorkingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) { if (new Date(now.getFullYear(), now.getMonth(), d).getDay() !== 0) totalWorkingDays++; }
  const workingDaysLeft = Math.max(0, totalWorkingDays - workingDaysElapsed);
  const monthProgress = totalWorkingDays ? Math.round((workingDaysElapsed / totalWorkingDays) * 100) : 0;
  const avgPerDay = workingDaysElapsed ? Math.round(actualMonthly / workingDaysElapsed) : 0;
  const scrapRate = actualMonthly + scrapMonthly > 0 ? (scrapMonthly / (actualMonthly + scrapMonthly)) * 100 : 0;

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <PageHead title="Production Overview" sub={prettyMonth(curMonth())} icon={LayoutDashboard} />
        <span className="text-ink-soft text-[13px]">{new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}</span>
      </div>

      {/* GLANCE STATUS — read "are we on track?" in 2 seconds. The traveling
          BorderBeam appears only while the realtime connection is live. */}
      <div className={`relative overflow-hidden ${PANEL_HERO} ${live ? "border-beam" : ""} rounded-[10px] mb-5`}>
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: STATUS[lvl].hex }} />
        <Crosshair className="absolute top-4 right-4" />
        <div className="p-6 pl-8 pr-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div>
            <Eyebrow className="mb-1.5 !text-[11px]">This month — produced vs plan</Eyebrow>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[clamp(2.8rem,5vw,3.4rem)] font-bold tnum leading-[0.9] text-ink"><AnimatedNumber value={actualMonthly} /></span>
              <span className="text-ink-dim text-lg font-medium font-mono">/ {totalMonthly.toLocaleString()}</span>
            </div>
          </div>
          <div className="sm:text-right">
            <div className="flex items-center gap-2 sm:justify-end">
              <StatusPill level={lvl} size="lg" />
              <VarianceChip delta={paceDelta} pct={pacePct} level={lvl} />
            </div>
            <div className="text-ink-soft text-sm mt-2 max-w-xs">{monthlyPct}% of plan · {paceText}</div>
          </div>
        </div>
        <div className="relative h-1.5 bg-inset">
          <m.div initial={{ width: 0 }} animate={{ width: `${Math.min(monthlyPct, 100)}%` }} transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }} className="h-full" style={{ background: STATUS[lvl].hex }} />
          {[25, 50, 75].map((t) => <span key={t} className="absolute top-0 bottom-0 w-px bg-base/70" style={{ left: `${t}%` }} />)}
        </div>
      </div>

      {/* Balanced 4-tile metric strip — each a distinct cut (live · momentum ·
          quality · time), differentiated by micro-viz (gauge / sparkline / rate /
          progress) so they read intentional, not stamped clones. */}
      <m.div variants={containerV} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi title="Produced today" value={actualToday} unit={`/ ${dailyTargetRounded}`} sub={`${dailyPct}% of today's target`} subLevel={levelForPct(dailyPct)} pct={dailyPct} />
        <Kpi title="Avg / working day" value={avgPerDay} unit="units" sub={`over ${workingDaysElapsed} day${workingDaysElapsed === 1 ? "" : "s"} so far`} spark={sparkDaily} sparkLevel={lvl} />
        <Kpi title="Scrap (MTD)" value={scrapMonthly} unit="units" sub={`${scrapRate.toFixed(1)}% of total output`} subLevel={scrapRate > 3 ? "warn" : null} pct={Math.min((scrapRate / 5) * 100, 100)} pctNeutral />
        <Kpi title="Working days left" value={workingDaysLeft} unit={`/ ${totalWorkingDays}`} sub={`${monthProgress}% of the month elapsed`} pct={monthProgress} pctNeutral />
      </m.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-5">
        <Panel title="Pace vs Plan — by Component" tag="01" hero className="lg:col-span-7" right={
          <span className="hidden sm:flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[2px] bg-bad" />behind</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: "#5C6573" }} />on / ahead</span>
          </span>
        }>
          {compData.length === 0 ? <Empty msg="Set monthly targets in Plan Setup to see this chart." /> : (
            <ResponsiveContainer width="100%" height={Math.max(compData.length * 46 + 28, 200)}>
              <BarChart data={compData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }} barCategoryGap="30%">
                <defs>
                  {Object.entries(STATUS).map(([k, s]) => (
                    <linearGradient key={k} id={`dev-${k}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={s.hex} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={s.hex} stopOpacity={1} />
                    </linearGradient>
                  ))}
                  <linearGradient id="dev-steel" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#5C6573" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#5C6573" stopOpacity={0.95} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 6" stroke={HEX.grid} horizontal={false} />
                <XAxis type="number" domain={[-maxDev, maxDev]} tick={{ fill: HEX.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v > 0 ? `+${v}` : v)} height={22} />
                <YAxis type="category" dataKey="name" width={108} tick={{ fill: HEX.axis2, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                <Tooltip content={<CompTip />} cursor={{ fill: "rgba(94,231,255,0.05)" }} />
                <ReferenceLine x={0} stroke={HEX.brand} strokeOpacity={0.55} strokeDasharray="3 3" />
                <Bar dataKey="dev" barSize={16} shape={<DevBar />} isAnimationActive={!REDUCED}>
                  <LabelList content={makeDevLabel(compData)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Daily Output Trend" tag="02" hero className="lg:col-span-5">
          {trend.length === 0 ? <Empty msg="No production logged yet this month." /> : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trend} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                <defs>
                  {/* split the line + fill at the daily-target line: green above, amber below */}
                  <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={0} stopColor={STATUS.ok.hex} />
                    <stop offset={splitOff} stopColor={STATUS.ok.hex} />
                    <stop offset={splitOff} stopColor={STATUS.warn.hex} />
                    <stop offset={1} stopColor={STATUS.warn.hex} />
                  </linearGradient>
                  <linearGradient id="splitFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={0} stopColor={STATUS.ok.hex} stopOpacity={0.22} />
                    <stop offset={splitOff} stopColor={STATUS.ok.hex} stopOpacity={0.05} />
                    <stop offset={splitOff} stopColor={STATUS.warn.hex} stopOpacity={0.05} />
                    <stop offset={1} stopColor={STATUS.warn.hex} stopOpacity={0.16} />
                  </linearGradient>
                  <filter id="trendGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor={HEX.brand} floodOpacity="0.45" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="2 6" stroke={HEX.grid} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: HEX.axis2, fontSize: 12 }} axisLine={{ stroke: HEX.grid }} tickLine={false} />
                <YAxis domain={[0, trendDomainMax]} allowDecimals={false} tick={{ fill: HEX.axis, fontSize: 12 }} axisLine={false} tickLine={false} width={34} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: HEX.axis2, strokeDasharray: "4 4", strokeWidth: 1 }} />
                <ReferenceLine y={dailyTargetRounded} stroke={HEX.axis2} strokeDasharray="5 5" label={{ value: "daily target", fill: HEX.axis2, fontSize: 10, position: "insideTopRight" }} />
                <Area type="stepAfter" dataKey="actual" name="Output" stroke="url(#splitStroke)" strokeWidth={2.25} fill="url(#splitFill)" style={{ filter: "url(#trendGlow)" }} dot={false} isAnimationActive={!REDUCED} activeDot={{ r: 4, fill: HEX.brand, stroke: "#020203", strokeWidth: 2 }} />
                {/* clean overlay carries only the live "now" pulse dot (no glow on it) */}
                <Area type="stepAfter" dataKey="actual" stroke="none" fill="none" legendType="none" tooltipType="none" isAnimationActive={false} activeDot={false} dot={<PulseDot dataLen={trend.length} />} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Panel title="Today — Plan vs Actual" tag="03" className="lg:col-span-5" right={<span className="font-mono text-ink-dim text-[11px] tnum tracking-wide">{today}</span>}>
          <div className="flex items-end justify-between mb-3">
            <div><Eyebrow className="mb-1 !text-[11px]">Actual</Eyebrow><div className="font-mono text-[40px] font-bold tnum leading-none">{actualToday}</div></div>
            <StatusPill level={levelForPct(dailyPct)} label={`${dailyPct}%`} />
            <div className="text-right"><Eyebrow className="mb-1 !text-[11px]">Target</Eyebrow><div className="font-mono text-[40px] font-bold text-ink-dim tnum leading-none">{Math.round(dailyTargetTotal)}</div></div>
          </div>
          <div className="mb-5"><Meter pct={dailyPct} level={levelForPct(dailyPct)} height="h-2.5" ticks /></div>
          <div className="grid grid-cols-3 gap-3">
            {shiftData.map((s) => (
              <div key={s.id} className="rounded-xl border border-hair bg-inset p-3 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
                <div className="text-ink text-xs font-bold">{s.label}</div>
                <div className="font-mono text-ink-dim text-[10px] mb-1.5">{s.time}</div>
                <div className="font-mono text-[28px] font-bold tnum text-ink leading-none">{s.qty}</div>
                <div className="font-mono text-ink-dim text-[10px] uppercase tracking-wider mt-1">units</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Component Performance" tag="04" className="lg:col-span-7">
          {compData.length === 0 ? <Empty msg="No components with targets yet." /> : (
            <div className="divide-y divide-hair -my-1">
              {compData.map((c, i) => {
                const cl = levelForPct(c.pct);
                const off = c.pct >= 100;           // on/ahead → no action dot, calm steel spark
                const sc = barFill(c.pct);
                return (
                  <div key={c.name} className="flex items-center gap-3 py-2.5">
                    {/* action dot — lit ONLY for an exception (HPHMI: colour = something to act on) */}
                    <span className="relative shrink-0 grid place-items-center w-3 h-3" aria-hidden="true">
                      {!off && <span className="absolute inset-0 rounded-full" style={{ background: STATUS[cl].hex, opacity: 0.22 }} />}
                      <span className="w-2 h-2 rounded-full" style={{ background: off ? "transparent" : STATUS[cl].hex, border: off ? "1.5px solid rgba(220,228,242,0.18)" : "none" }} />
                    </span>
                    <span className="font-semibold text-ink text-[13px] w-[7.5rem] shrink-0 truncate">{c.name}</span>
                    {/* per-component daily sparkline — momentum, not just a static percentage */}
                    <div className="flex-1 h-8 min-w-0">
                      {c.spark.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={c.spark} margin={{ top: 4, right: 1, left: 1, bottom: 0 }}>
                            <defs>
                              <linearGradient id={`csp-${i}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={sc} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={sc} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="v" stroke={sc} strokeWidth={1.5} fill={`url(#csp-${i})`} dot={false} isAnimationActive={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : <div className="h-px w-full bg-hair mt-4" />}
                    </div>
                    <span className="font-mono text-[11px] tnum text-ink-soft shrink-0 tabular-nums" title="actual / expected-to-date">{c.actual.toLocaleString()}<span className="text-ink-dim">/{c.expected.toLocaleString()}</span></span>
                    <span className="shrink-0"><VarianceChip delta={c.dev} pct={c.pct - 100} level={cl} /></span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-3 mt-1 text-sm border-t border-hair">
                <span className="text-ink-soft font-medium">Scrap this month</span>
                <span className="font-mono font-bold tnum text-ink">{scrapMonthly} units</span>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

/* ------------------------------ Shift Entry ------------------------------- */
function ShiftEntry({ data, user, reload }) {
  const { components, machines, entries } = data;
  const [date, setDate] = useState(todayStr());
  const [shift, setShift] = useState(1);
  const [componentId, setComponentId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [qty, setQty] = useState(0);
  const [scrap, setScrap] = useState(0);
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [delEntry, setDelEntry] = useState(null); // entry pending delete-confirm
  const [delBusy, setDelBusy] = useState(false);

  useEffect(() => { if (!componentId && components[0]) setComponentId(components[0].id); }, [components]);
  useEffect(() => { if (!machineId && machines[0]) setMachineId(machines[0].id); }, [machines]);
  // Confirm-dialog focus management (ARIA dialog pattern): move focus in on open,
  // trap Tab inside, close on Esc, restore focus to the trigger on close.
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!confirm) return;
    const prev = document.activeElement;
    const focusables = () => dialogRef.current
      ? [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      : [];
    focusables()[0]?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { closeConfirm(); return; }
      if (e.key !== "Tab") return;
      const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [confirm]);

  const isManager = user.role !== "operator";
  const compName = (id) => components.find((c) => c.id === id)?.name || "—";
  const machName = (id) => machines.find((m) => m.id === id)?.code || "—";

  const dup = entries.find((e) => e.production_date === date && e.shift === shift && e.component_id === componentId && e.operator_id === user.id);

  const closeConfirm = () => { setConfirm(false); setError(""); };
  const open = () => { if (componentId && qty >= 0) { setError(""); setConfirm(true); } };
  const doSave = async () => {
    if (saving) return; // guard against a double-tap firing addEntry twice
    setSaving(true);
    try {
      await db.addEntry({ production_date: date, shift, component_id: componentId, machine_id: machineId || null, operator_id: user.id, quantity: Number(qty), scrap_qty: Number(scrap), notes: notes.trim() });
    } catch (e) {
      setError(e?.message || "Could not save this entry. Please try again.");
      setSaving(false);
      return;
    }
    setError(""); setConfirm(false); setQty(0); setScrap(0); setNotes("");
    setToast(`Recorded ${compName(componentId)} · Shift ${shift}`); setTimeout(() => setToast(""), 2200);
    await reload();
    setSaving(false);
  };

  // Destructive: only runs after the focus-trapped ConfirmDialog is confirmed.
  const confirmDeleteEntry = async () => {
    if (delBusy || !delEntry) return;
    setDelBusy(true);
    try { await db.removeEntry(delEntry.id); await reload(); setDelEntry(null); }
    catch { /* leave the dialog open so the user can retry */ }
    finally { setDelBusy(false); }
  };

  let recent = [...entries].sort((a, b) => b.created_at - a.created_at);
  if (!isManager) recent = recent.filter((e) => e.operator_id === user.id);
  recent = recent.slice(0, 9);

  const Stepper = ({ value, set }) => (
    <div className="flex items-center gap-3">
      <button onClick={() => set(Math.max(0, value - 1))} aria-label="Decrease" className="w-16 h-16 rounded-xl grid place-items-center active:scale-95 transition border border-hair bg-inset text-ink hover:border-brand-500/55 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"><Minus size={24} /></button>
      <input type="number" min="0" value={value} onChange={(e) => set(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-24 text-center font-mono text-4xl font-bold tnum bg-inset border border-hair rounded-xl py-2 text-ink focus:border-brand-500 outline-none transition" />
      <button onClick={() => set(value + 1)} aria-label="Increase" className="w-16 h-16 rounded-xl grid place-items-center active:scale-95 transition border border-hair bg-inset text-ink hover:border-brand-500/55 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"><Plus size={24} /></button>
    </div>
  );

  const chip = (active) => active ? "border-brand-500 bg-brand-500/[0.10] text-brand-200 ring-1 ring-brand-500/30" : "border-hair bg-inset text-ink-soft hover:border-brand-500/40";

  return (
    <>
      <PageHead title="Shift Entry" sub={`Logging as ${user.name} · output is recorded against the date the shift started`} icon={ClipboardList} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-6">
        <Panel title="Record Output" tag="IN" className="lg:col-span-7">
          <label className={labelCls}>Production Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} mb-4`} />

          <label className={labelCls}>Shift</label>
          <div className="grid grid-cols-3 gap-2.5 mb-2">
            {SHIFTS.map((s) => (
              <button key={s.id} onClick={() => setShift(s.id)} aria-pressed={shift === s.id} className={`min-h-[68px] py-3 rounded-xl border-2 text-center transition active:scale-95 ${chip(shift === s.id)}`}>
                <div className="font-bold text-[15px]">{s.label}</div><div className="font-mono text-[10px] opacity-80">{s.time}</div>
              </button>
            ))}
          </div>
          {shift === 3 && <div className={`${hintCls} mb-4`}><Clock size={14} className="shrink-0 mt-0.5 text-warn-ink" /><span>Shift 3 runs past midnight — log it under the day it <b>started</b>.</span></div>}
          <div className="mb-4" />

          <label className={labelCls}>Component</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
            {components.map((c) => (
              <button key={c.id} onClick={() => setComponentId(c.id)} aria-pressed={componentId === c.id} className={`min-h-[60px] px-3 py-3 rounded-xl border-2 text-left transition active:scale-95 ${chip(componentId === c.id)}`}>
                <div className="font-bold text-sm text-ink leading-tight">{c.name}</div>
                <div className="font-mono text-[10px] text-ink-dim mt-0.5 uppercase tracking-wide">{c.industry}</div>
              </button>
            ))}
          </div>

          <label className={labelCls}>Machine</label>
          <div className="flex flex-wrap gap-2 mb-5">
            {machines.map((m) => (
              <button key={m.id} onClick={() => setMachineId(m.id)} aria-pressed={machineId === m.id} className={`px-4 py-3 rounded-xl border-2 text-sm font-semibold font-mono transition active:scale-95 ${chip(machineId === m.id)}`}>{m.code}</button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className={labelCls}>Quantity Produced</label><Stepper value={qty} set={setQty} /></div>
            <div><label className={labelCls}>Scrap (optional)</label><Stepper value={scrap} set={setScrap} /></div>
          </div>

          <label className={labelCls}>Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Tool change, machine issue, etc." className={`${inputCls} mb-4 resize-none`} />

          {dup && <div className={`${warnCls} mb-3`}><AlertTriangle size={16} className="shrink-0" /><span>You already logged <b>{compName(componentId)}</b> for Shift {shift} on this date. You'll be asked to confirm.</span></div>}

          <button onClick={open} disabled={!componentId} className={`${btnPrimary} !text-base !py-4 disabled:opacity-50 disabled:pointer-events-none`}>Record Output <ArrowRight size={20} className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1" /></button>
        </Panel>

        <Panel title={isManager ? "Recent Entries (all operators)" : "My Recent Entries"} tag="LOG" className="lg:col-span-5">
          {recent.length === 0 && <Empty msg="No entries yet — log your first one." />}
          <div className="space-y-2">
            {recent.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-3.5 py-3 bg-inset border border-hair rounded-xl">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-ink truncate">{compName(e.component_id)}</div>
                  <div className="font-mono text-[11px] text-ink-dim tnum mt-0.5">{e.production_date} · Shift {e.shift} · {machName(e.machine_id)}{e.scrap_qty ? ` · ${e.scrap_qty} scrap` : ""}{e.notes ? " · note" : ""}</div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right tabular-nums">
                    <div className="font-mono font-bold text-[19px] tnum text-ink leading-none">{e.quantity}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-ink-dim mt-1">units</div>
                  </div>
                  {isManager && <button onClick={() => setDelEntry(e)} aria-label="Delete entry" className="p-2 min-h-[44px] min-w-[44px] grid place-items-center rounded-lg text-ink-dim hover:bg-white/[0.06] hover:text-bad-ink transition"><Trash2 size={15} /></button>}
                </div>
              </div>
            ))}
          </div>
          {!isManager && <div className={`${hintCls} mt-3`}><ShieldCheck size={14} className="shrink-0 mt-0.5 text-ink-dim" /><span>Only a supervisor can edit or delete entries.</span></div>}
        </Panel>
      </div>

      <AnimatePresence>
        {confirm && (
          <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-base/85 p-4" onClick={closeConfirm}>
            <m.div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="confirm-title" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ type: "spring", stiffness: 360, damping: 30 }} className="bg-over border border-hair-strong relative overflow-hidden rounded-[10px] p-6 w-full max-w-sm shadow-pop" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h3 id="confirm-title" className="font-display font-bold text-lg">Confirm entry</h3><button onClick={closeConfirm} aria-label="Close" className="p-2 min-h-[44px] min-w-[44px] grid place-items-center rounded-lg text-ink-dim hover:bg-white/[0.06]"><X size={18} /></button></div>
              <div className="space-y-2.5 mb-5">
                {[["Date", date], ["Shift", `Shift ${shift}`], ["Component", compName(componentId)], ["Machine", machName(machineId)], ["Quantity", `${qty} units`], ["Scrap", `${scrap} units`]].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm"><span className="font-mono text-ink-dim text-[12px] uppercase tracking-wide">{k}</span><span className="font-semibold text-ink">{v}</span></div>
                ))}
                {notes && <div className="text-sm pt-1"><span className="font-mono text-ink-dim text-[12px] uppercase tracking-wide">Notes</span><div className="text-ink mt-0.5">{notes}</div></div>}
              </div>
              {dup && <div className={`${warnCls} mb-4`}><AlertTriangle size={16} className="shrink-0" /><span>A matching entry already exists for this shift. Confirm only if this is additional output.</span></div>}
              {error && <div className={`${errCls} mb-4`}><AlertTriangle size={16} className="shrink-0" /><span>{error}</span></div>}
              <div className="flex gap-3">
                <button onClick={closeConfirm} disabled={saving} className={`${btnSecondary} flex-1 !py-3.5`}>Cancel</button>
                <button onClick={doSave} disabled={saving} className="flex-1 py-3.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-[#04161a] font-semibold active:scale-[0.98] transition flex items-center justify-center gap-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22)] disabled:opacity-60 disabled:cursor-not-allowed">{saving ? "Saving…" : <><Check size={18} /> Confirm</>}</button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <m.div role="status" aria-live="polite" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="fixed bottom-5 right-5 z-50 bg-coal border border-hair rounded-[8px] shadow-pop px-4 py-3 flex items-center gap-3">
            <span className="w-5 h-5 rounded-full bg-ok grid place-items-center shrink-0"><Check size={13} className="text-[#020203]" /></span>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim">Logged</div>
              <div className="text-ink font-semibold text-sm">{toast}</div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!delEntry}
        title="Delete this entry?"
        body={delEntry ? <>This permanently removes <b className="text-ink">{compName(delEntry.component_id)}</b> · Shift {delEntry.shift} · <span className="font-mono tnum">{delEntry.quantity}</span> units ({delEntry.production_date}). This can't be undone.</> : null}
        confirmLabel="Delete entry"
        danger
        busy={delBusy}
        onConfirm={confirmDeleteEntry}
        onClose={() => { if (!delBusy) setDelEntry(null); }}
      />
    </>
  );
}

/* ------------------------------ Plan Setup -------------------------------- */
function PlanSetup({ data, reload }) {
  const { components, plans } = data;
  const month = curMonth();
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [industry, setIndustry] = useState("railway");
  const [adding, setAdding] = useState(false);
  const [delComp, setDelComp] = useState(null); // component pending remove-confirm
  const [delBusy, setDelBusy] = useState(false);

  const planFor = (cid) => plans.find((p) => p.component_id === cid);
  const changeTarget = async (cid, v) => { const p = planFor(cid); await db.upsertPlan({ month, component_id: cid, target_qty: parseInt(v, 10) || 0, working_days: p?.working_days ?? 26 }); await reload(); };
  const changeWD = async (cid, v) => { const p = planFor(cid); await db.upsertPlan({ month, component_id: cid, target_qty: p?.target_qty ?? 0, working_days: Math.max(1, parseInt(v, 10) || 1) }); await reload(); };
  const addComponent = async () => { if (!name.trim() || adding) return; setAdding(true); try { await db.addComponent({ code: code.trim(), name: name.trim(), industry }); setName(""); setCode(""); await reload(); } finally { setAdding(false); } };
  // Destructive: only runs after the focus-trapped ConfirmDialog is confirmed.
  const confirmRemoveComponent = async () => {
    if (delBusy || !delComp) return;
    setDelBusy(true);
    try { await db.deactivateComponent(delComp.id); await reload(); setDelComp(null); }
    catch { /* leave the dialog open so the user can retry */ }
    finally { setDelBusy(false); }
  };

  return (
    <>
      <PageHead title="Plan Setup" sub={`${prettyMonth(month)} · daily & per-shift targets are auto-calculated`} icon={Settings2} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 mt-6">
        <Panel title="Planning Period" tag="01">
          <label className={labelCls}>Plan Month</label>
          <input value={prettyMonth(month)} disabled className={`${inputCls} opacity-70 mb-4`} />
          <div className="bg-inset border border-hair rounded-xl p-4 text-sm text-ink leading-relaxed">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-300/80 mb-1.5">Note</div>
            Each component has its own <b>monthly target</b> and <b>working days</b>. Daily target = target ÷ working days, then split across the 3 shifts.
          </div>
        </Panel>

        <Panel title="Add New Component" tag="02">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="col-span-2"><label className={labelCls}>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Clamping Plate" className={inputCls} /></div>
            <div><label className={labelCls}>Code</label><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CP-100" className={inputCls} /></div>
          </div>
          <label className={labelCls}>Industry</label>
          <div className="grid grid-cols-4 gap-2 mb-5">
            {["railway", "wind", "marine", "other"].map((ind) => (
              <button key={ind} onClick={() => setIndustry(ind)} aria-pressed={industry === ind} className={`min-h-[44px] py-2.5 rounded-lg border text-xs font-semibold capitalize transition active:scale-95 ${industry === ind ? "border-brand-500 bg-brand-500/[0.10] text-brand-200 ring-1 ring-brand-500/30" : "border-hair bg-inset text-ink-soft hover:border-brand-500/40"}`}>{ind}</button>
            ))}
          </div>
          <button onClick={addComponent} disabled={!name.trim() || adding} className={`${btnPrimary} disabled:opacity-50 disabled:pointer-events-none`}>{adding ? "Adding…" : <><Plus size={18} /> Add Component</>}</button>
        </Panel>
      </div>

      <Panel title="Components, Targets & Working Days" tag="03">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[640px]">
            <thead><tr className="text-left font-mono text-ink-dim text-[10px] font-semibold uppercase tracking-[0.15em] border-b border-hair">
              <th className="py-2.5 px-2.5">Component</th><th className="py-2.5 px-2.5">Industry</th>
              <th className="py-2.5 px-2.5 text-right">Monthly Target</th><th className="py-2.5 px-2.5 text-right">Working Days</th>
              <th className="py-2.5 px-2.5 text-right">Daily</th><th className="py-2.5 px-2.5 text-right">Per Shift</th><th className="py-2.5 px-2.5 w-10" />
            </tr></thead>
            <tbody>
              {components.map((c) => {
                const p = planFor(c.id); const target = p?.target_qty ?? 0; const wd = p?.working_days ?? 26; const daily = target / wd;
                return (
                  <tr key={c.id} className="border-b border-hair last:border-0 hover:bg-white/[0.025] transition">
                    <td className="py-3 px-2.5 font-semibold text-sm">{c.name}{c.code && <span className="text-ink-dim font-normal font-mono text-xs"> · {c.code}</span>}</td>
                    <td className="py-3 px-2.5 text-sm text-ink-soft capitalize">{c.industry || "—"}</td>
                    <td className="py-3 px-2.5 text-right"><input type="number" min="0" defaultValue={target} onBlur={(e) => changeTarget(c.id, e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={cellCls} /></td>
                    <td className="py-3 px-2.5 text-right"><input type="number" min="1" defaultValue={wd} onBlur={(e) => changeWD(c.id, e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={cellCls} /></td>
                    <td className="py-3 px-2.5 text-right font-bold text-brand-300 font-mono tnum">{daily.toFixed(1)}</td>
                    <td className="py-3 px-2.5 text-right text-ink-soft font-mono tnum">{(daily / 3).toFixed(1)}</td>
                    <td className="py-3 px-2.5"><button onClick={() => setDelComp(c)} aria-label={`Remove ${c.name}`} className="p-2 min-h-[44px] min-w-[44px] grid place-items-center rounded-lg text-ink-dim hover:bg-white/[0.06] hover:text-bad-ink transition"><Trash2 size={15} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={`${hintCls} mt-3`}><Check size={14} className="shrink-0 mt-0.5 text-ok-ink" /><span>Edit a target or working days and click away (or press Enter) to save. Removing a component hides it but keeps its production history.</span></div>
      </Panel>

      <ConfirmDialog
        open={!!delComp}
        title="Remove this component?"
        body={delComp ? <>This hides <b className="text-ink">{delComp.name}</b>{delComp.code ? ` (${delComp.code})` : ""} from entry and planning. Its production history is kept, and you can re-add it later.</> : null}
        confirmLabel="Remove component"
        danger
        busy={delBusy}
        onConfirm={confirmRemoveComponent}
        onClose={() => { if (!delBusy) setDelComp(null); }}
      />
    </>
  );
}

/* ------------------------------ UI bits ----------------------------------- */
const inputCls = "w-full px-4 py-3 bg-inset border border-hair-strong rounded-xl text-ink text-[15px] font-medium placeholder-ink-dim focus:border-brand-500 outline-none transition";
const cellCls = "w-24 px-2.5 py-2.5 min-h-[44px] text-right bg-inset border border-hair-strong rounded-lg font-semibold text-ink font-mono tnum focus:border-brand-500 outline-none transition";
const labelCls = "block font-mono text-ink-soft text-[11px] font-semibold uppercase tracking-[0.12em] mb-2";
const btnPrimary = "group w-full py-3.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-[#04161a] font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22)]";
// Two tiers keep blue on the CTA only: primary = solid brand (btnPrimary);
// secondary = neutral inset + ring, brand showing ONLY on hover (non-CTA actions).
const btnSecondary = "min-h-[44px] px-4 py-3 rounded-lg bg-inset ring-1 ring-hair-strong text-ink font-semibold text-sm flex items-center justify-center gap-2 transition hover:ring-brand-500/50 hover:bg-brand-500/[0.08] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
const hintCls = "flex gap-2 text-[13px] text-ink-soft bg-inset border border-hair rounded-xl px-3.5 py-3 leading-relaxed";
const warnCls = "flex items-center gap-2 text-sm text-warn-ink bg-warn-soft border border-warn/25 px-3.5 py-3 rounded-xl leading-snug";
const errCls = "flex items-center gap-2 text-sm text-bad-ink bg-bad-soft border border-bad/25 px-3.5 py-3 rounded-xl leading-snug";

// Reusable focus-trapped confirm dialog for DESTRUCTIVE actions (ARIA dialog pattern:
// move focus in on open, trap Tab, Esc cancels, focus restored to the trigger on close).
function ConfirmDialog({ open, title, body, confirmLabel = "Confirm", danger = false, busy = false, onConfirm, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const focusables = () => ref.current
      ? [...ref.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      : [];
    focusables()[0]?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-base/85 p-4" onClick={onClose}>
          <m.div ref={ref} role="dialog" aria-modal="true" aria-labelledby="confirm-dlg-title" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ type: "spring", stiffness: 360, damping: 30 }} className="bg-over border border-hair-strong relative overflow-hidden rounded-[10px] p-6 w-full max-w-sm shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 id="confirm-dlg-title" className="font-display font-bold text-lg">{title}</h3>
              <button onClick={onClose} aria-label="Cancel" className="p-2 min-h-[44px] min-w-[44px] grid place-items-center rounded-lg text-ink-dim hover:bg-white/[0.06]"><X size={18} /></button>
            </div>
            {body && <div className="text-sm text-ink-soft leading-relaxed mb-5">{body}</div>}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={busy} className={`${btnSecondary} flex-1 !py-3.5`}>Cancel</button>
              <button onClick={onConfirm} disabled={busy} className={`flex-1 py-3.5 rounded-lg font-semibold active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${danger ? "bg-[#C8362C] hover:bg-[#B02C23] text-white" : "bg-brand-500 hover:bg-brand-600 text-[#04161a]"}`}>{busy ? "Working…" : confirmLabel}</button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

// Machined gauge — a squared track with hairline tick dividers (an engineering
// meter, not a consumer pill bar). Fills once on mount; status-coloured.
function Meter({ pct, level, height = "h-2.5", ticks = false, color }) {
  const fill = color || (level ? STATUS[level].hex : HEX.brand);
  return (
    <div className={`relative w-full ${height} bg-inset rounded-[2px] overflow-hidden`}>
      <m.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }} transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }} className="h-full rounded-[1px]" style={{ background: fill }} />
      {ticks && [25, 50, 75].map((t) => <span key={t} className="absolute top-0 bottom-0 w-px bg-base/70" style={{ left: `${t}%` }} />)}
    </div>
  );
}

// Lead tile (asymmetric hero) carries a mini gauge; compact supporting tiles are
// bare number+label — varied layouts, not stamped clones.
// Dense metric tile — every tile carries 3 packed lines (eyebrow → big mono
// number+unit → context) plus ONE micro-viz (gauge OR sparkline), so no tile is
// ever a lone number floating in dead space. Equal width; varied by micro-viz.
function Kpi({ title, value, unit, sub, subLevel, pct, pctNeutral, spark, sparkLevel }) {
  const sc = sparkLevel ? STATUS[sparkLevel].hex : HEX.brand;
  const sparkId = `kpi-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  return (
    <m.div variants={itemV} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 300, damping: 22 }} onPointerMove={spotlightMove}
      className={`spotlight overflow-hidden [contain:content] ${PANEL} rounded-[10px] p-5 hover:bg-inset/40 hover:border-brand-500/40 hover:shadow-card-hover transition`}>
      <Eyebrow className="!text-[11px]">{title}</Eyebrow>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="font-mono text-[32px] font-bold leading-none tnum text-ink">{typeof value === "number" ? <AnimatedNumber value={value} /> : value}</span>
        {unit && <span className="font-mono text-ink-dim text-xs">{unit}</span>}
      </div>
      {sub && <div className={`text-[12px] font-semibold mt-2 leading-snug ${subLevel ? STATUS[subLevel].text : "text-ink-soft"}`}>{sub}</div>}
      {typeof pct === "number" && (
        <div className="mt-3.5"><Meter pct={pct} level={pctNeutral ? null : subLevel} color={pctNeutral ? "#5C6573" : undefined} height="h-1.5" ticks /></div>
      )}
      {spark && spark.length > 1 && (
        <div className="mt-3.5 -mb-1 h-9">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sc} stopOpacity={0.26} />
                  <stop offset="100%" stopColor={sc} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={sc} strokeWidth={1.5} fill={`url(#${sparkId})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </m.div>
  );
}

const Panel = ({ title, right, tag, children, className = "", hero = false }) => (
  <div onPointerMove={hero ? spotlightMove : undefined} className={`${hero ? `${PANEL_HERO} spotlight` : PANEL} rounded-[10px] p-5 ${className}`}>
    <div className="flex items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-2.5">
        {tag && <span className="font-mono text-[10px] text-brand-300/80 border border-hair px-1.5 py-0.5 tracking-wider">//{tag}</span>}
        <span className="font-display font-semibold text-[15px] text-ink">{title}</span>
      </div>
      {right}
    </div>
    {children}
  </div>
);

// Page headings stand on their own — a thin brand rule anchors them, no
// decorative icon-in-a-box (and no reusing the nav icon).
const PageHead = ({ title, sub }) => (
  <div className="border-l-2 border-brand-500 pl-4">
    <h1 className="font-display text-[clamp(1.5rem,2.6vw,1.75rem)] font-extrabold tracking-[-0.01em] leading-none text-ink">{title}</h1>
    <div className="text-ink-soft text-sm mt-2">{sub}</div>
  </div>
);

const Empty = ({ msg }) => (
  <div className="relative overflow-hidden rounded-lg bg-inset/50 border border-hair py-10 px-5 text-center">
    <Crosshair className="absolute top-3 left-3" />
    <Crosshair className="absolute bottom-3 right-3" />
    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim mb-2">No data</div>
    <div className="text-ink-soft text-sm max-w-xs mx-auto">{msg}</div>
  </div>
);
