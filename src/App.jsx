import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { m, AnimatePresence, useMotionValue, useTransform, useSpring, animate } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area, ReferenceLine, LabelList,
} from "recharts";
import {
  SquaresFour as LayoutDashboard, ClipboardText as ClipboardList,
  SlidersHorizontal as Settings2, UsersThree as Users, Gauge, Copy, Plus, Trash as Trash2, Check, SignOut as LogOut, X,
  TrendUp as TrendingUp, TrendDown as TrendingDown, Clock, ArrowRight,
  Warning as AlertTriangle, ShieldCheck, Backspace as Delete, Minus, Eye, EyeSlash,
} from "@phosphor-icons/react";
import { db, seedIfEmpty, MODE, CONFIG_ERROR } from "./lib/db";
import ScrollExpandMedia from "./components/ui/ScrollExpandMedia";
import { LiquidButton, MetalButton } from "./components/ui/buttons";
import { NavBar } from "./components/ui/tubelight-navbar";
import { EtheralShadow } from "./components/ui/etheral-shadow";
import { opHours, componentCapacity, round1, round2, costing, inr, TARGET_HR } from "./lib/capacity";
import { scheduleMachine, monthBounds, fmtDate } from "./lib/schedule";

// Login hero imagery (industrial). onError in ScrollExpandMedia falls back from
// the expanding media to the background photo, so a 404 never shows a broken icon.
const HERO_BG = "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1920&q=80";
const HERO_MEDIA = "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1500&q=80";

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
    ? "radial-gradient(58% 52% at 66% 32%, rgba(96,165,250,0.14), transparent 70%), radial-gradient(48% 44% at 14% 98%, rgba(120,138,180,0.06), transparent 72%)"
    : "radial-gradient(46% 42% at 84% 18%, rgba(96,165,250,0.08), transparent 72%)";
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

// Monochrome status (user prefers this over colorful — he saw the colorful
// shadcn charts and explicitly reverted): on-track recedes (dim gray), behind
// brighter gray, critical = brightest (white). brightness = urgency.
const STATUS = {
  ok: { label: "On Track", text: "text-ok-ink", soft: "bg-ok-soft", solid: "bg-ok", hex: "#52525B", Icon: TrendingUp },
  warn: { label: "Behind", text: "text-warn-ink", soft: "bg-warn-soft", solid: "bg-warn", hex: "#A1A1AA", Icon: AlertTriangle },
  bad: { label: "Critical", text: "text-bad-ink", soft: "bg-bad-soft", solid: "bg-bad", hex: "#FAFAFA", Icon: TrendingDown },
};
const levelForPct = (p) => (p >= 100 ? "ok" : p >= 80 ? "warn" : "bad");
const levelForPace = (pace) => (pace >= 0.97 ? "ok" : pace >= 0.85 ? "warn" : "bad");
// brand accent = white (mono) — live trend dot/glow + zero rail.
const HEX = { brand: "#FAFAFA", grid: "rgba(255,255,255,0.07)", ghost: "rgba(255,255,255,0.12)", axis: "#71717A", axis2: "#A1A1AA" };
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

const PANEL = "bg-gradient-to-b from-panelhi/30 to-panel border border-hair shadow-card";
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
    <div className="hidden sm:block font-mono text-ink-dim text-[10px] tracking-[0.22em] uppercase mt-1.5">Production Console</div>
  </div>
);

// Mono technical eyebrow / annotation.
const Eyebrow = ({ children, className = "" }) => (
  <div className={`font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft ${className}`}>{children}</div>
);

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
const barFill = (pct) => (pct >= 100 ? "#71717A" : STATUS[levelForPct(pct)].hex);

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
      <circle cx={cx} cy={cy} r="3.5" fill={HEX.brand} stroke="#0A0A0A" strokeWidth="2" />
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
  const [data, setData] = useState({ components: [], machines: [], plans: [], entries: [], operations: [], machinePlan: [], settings: {} });
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
    const [plans, entries, operations, machinePlan, settings] = await Promise.all([db.getPlans(curMonth()), db.listEntries({ month: curMonth() }), db.listOperations ? db.listOperations() : Promise.resolve([]), db.listMachinePlanLines ? db.listMachinePlanLines(curMonth()) : Promise.resolve([]), db.getSettings ? db.getSettings() : Promise.resolve({})]);
    setData({ components, machines, plans, entries, operations, machinePlan, settings });
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
  const navTabs = user
    ? [
        { id: "dashboard", name: "Dashboard", icon: LayoutDashboard, roles: ["supervisor", "admin"] },
        { id: "entry", name: "Shift Entry", icon: ClipboardList, roles: ["operator", "supervisor", "admin"] },
        { id: "plan", name: "Plan Setup", icon: Settings2, roles: ["supervisor", "admin"] },
        { id: "loading", name: "Loading", icon: Gauge, roles: ["supervisor", "admin"] },
        { id: "team", name: "Team", icon: Users, roles: ["admin"] },
      ].filter((t) => t.roles.includes(user.role))
    : [];
  const activeTabName = (navTabs.find((t) => t.id === view) || navTabs[0] || {}).name;
  return (
    <AnimatePresence mode="wait">
      {!user ? (
        <m.div key="login" exit={{ opacity: 0, filter: "blur(8px)" }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
          <LoginScreen onLogin={onLogin} />
        </m.div>
      ) : (
        <m.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="min-h-[100dvh] text-ink relative">
          {/* Tubelight nav (replaces the sidebar — user's pick): floating pill,
              top-center on desktop, bottom thumb-bar on phones. */}
          <NavBar items={navTabs} activeTab={activeTabName} onItemClick={(t) => setView(t.id)} />
          {/* Slim fixed header: wordmark left (layoutId flight target from the
              login lockup) + live status, user, logout right. */}
          <header className="fixed top-0 inset-x-0 z-40 h-16 px-4 sm:px-6 flex items-center justify-between pointer-events-none bg-gradient-to-b from-base via-base/75 to-transparent">
            <div className="pointer-events-auto"><Wordmark /></div>
            <div className="pointer-events-auto flex items-center gap-3">
              {live && (
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ok-ink" title="Live — data updates in real time across devices">
                  <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full rounded-full bg-ok opacity-75 motion-safe:animate-ping" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-ok" /></span>
                  <span className="hidden lg:block">Live</span>
                </div>
              )}
              <div className="hidden lg:block font-semibold text-sm text-ink-soft max-w-[160px] truncate">{user.name}</div>
              <button onClick={logout} title="Log out" aria-label="Log out" className="p-2.5 min-h-[44px] min-w-[44px] grid place-items-center rounded-lg text-ink-dim hover:bg-white/[0.06] hover:text-ink transition shrink-0"><LogOut size={18} /></button>
            </div>
          </header>
          <div className="pt-20 pb-24 sm:pb-0">
            <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
              <AnimatePresence mode="wait">
                <m.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}>
                  {view === "dashboard" && <Dashboard data={data} live={live} setView={setView} />}
                  {view === "entry" && <ShiftEntry data={data} user={user} reload={loadData} />}
                  {view === "plan" && <PlanSetup data={data} reload={loadData} />}
                  {view === "loading" && <MachineLoading data={data} reload={loadData} />}
                  {view === "team" && <TeamAdmin user={user} />}
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
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("operator");
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [pending, setPending] = useState(false); // async auth in flight → block double-submit
  const [showPw, setShowPw] = useState(false);

  const press = (d) => { if (pending) return; setErr(""); setPin((p) => (p.length < 6 ? p + d : p)); };
  const back = () => { if (!pending) setPin((p) => p.slice(0, -1)); };
  const pinLogin = async () => {
    if (pending || pin.length === 0) return;
    setPending(true);
    try { const u = await db.loginByPin(pin); if (u) { onLogin(u); } else { setErr(MODE === "local" ? "Invalid PIN. Try 1001, 1002 or 1003." : "Invalid PIN."); setPin(""); } }
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
      className={`h-16 rounded-xl grid place-items-center text-2xl font-semibold transition-[filter,transform] duration-200 disabled:opacity-50 disabled:pointer-events-none ${
        variant === "go" ? "bg-gradient-to-b from-brand-300 to-brand-500 text-zinc-900 border-b-2 border-brand-700/70 ring-1 ring-inset ring-white/20 shadow-[0_4px_14px_-3px_rgba(0,0,0,0.55)] hover:brightness-110 active:brightness-95"
        : variant === "back" ? "bg-gradient-to-b from-inset to-[#1c1c21] border border-b-2 border-black/40 ring-1 ring-inset ring-white/[0.06] text-ink-soft hover:text-ink hover:brightness-115"
        : "bg-gradient-to-b from-inset to-[#1c1c21] border border-b-2 border-black/40 ring-1 ring-inset ring-white/[0.06] text-ink font-mono hover:brightness-115 active:brightness-95"}`}>{children}</m.button>
  );

  const modes = [["operator", "Operator"], ["manager", "Manager"]];

  return (
    <ScrollExpandMedia
      mediaSrc={HERO_MEDIA}
      bgImageSrc={HERO_BG}
      title="PRANA VENTURE"
      date="Production Console"
      scrollToExpand="Scroll · or tap the image to enter"
      enterLabel="Enter Console"
    >
      {/* etheral-shadow smoke fills the revealed section behind the sign-in card
          (gray on black — already monochrome; reduced-motion renders it static) */}
      <div className="absolute inset-0" aria-hidden="true">
        <EtheralShadow color="rgba(128, 128, 128, 1)" animation={{ scale: 100, speed: 90 }} noise={{ opacity: 1, scale: 1.2 }} sizing="fill" />
      </div>
      {/* sign-in revealed once the hero media fully expands */}
      <m.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[380px] rounded-2xl border border-hair bg-panel/85 backdrop-blur-xl shadow-pop p-6 sm:p-7">
        {/* brand lockup */}
        <div className="mb-6">
          <Wordmark />
        </div>

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
              <button key={id} onClick={() => { setMode(id); setErr(""); }} aria-pressed={mode === id} className={`relative z-10 min-h-[44px] py-3 rounded-lg text-sm font-semibold transition-colors ${mode === id ? "text-zinc-900" : "text-ink-soft hover:text-ink"}`}>{label}</button>
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
                    <div className="relative">
                      <input id="login-password" name="password" type={showPw ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setErr(""); }} placeholder="••••••••" className={`${inputCls} pr-12`} />
                      <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"} aria-pressed={showPw} className="absolute inset-y-0 right-0 w-12 grid place-items-center text-ink-dim hover:text-ink focus-visible:text-ink transition">
                        {showPw ? <EyeSlash size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <LiquidButton type="submit" size="xl" disabled={pending} className="group w-full mt-1">{pending ? "Signing in…" : <>Log in <ArrowRight size={18} className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1" /></>}</LiquidButton>
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
    </ScrollExpandMedia>
  );
}

/* ------------------------------ Sidebar ----------------------------------- */
// UNWIRED (kept for cheap reversal): replaced by the tubelight NavBar + slim
// fixed header (user's pick from his pasted components). To restore, swap the
// <NavBar/>+<header/> block in App back to <Sidebar .../> + pl-[68px] wrapper.
// Original notes: command-deck left rail, 240px desktop / 68px icon rail.
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
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: "#71717A" }} />on / ahead</span>
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
                    <stop offset="0%" stopColor="#71717A" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#71717A" stopOpacity={0.95} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 6" stroke={HEX.grid} horizontal={false} />
                <XAxis type="number" domain={[-maxDev, maxDev]} tick={{ fill: HEX.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v > 0 ? `+${v}` : v)} height={22} />
                <YAxis type="category" dataKey="name" width={108} tick={{ fill: HEX.axis2, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                <Tooltip content={<CompTip />} cursor={{ fill: "rgba(96,165,250,0.05)" }} />
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
                <Area type="stepAfter" dataKey="actual" name="Output" stroke="url(#splitStroke)" strokeWidth={2.25} fill="url(#splitFill)" style={{ filter: "url(#trendGlow)" }} dot={false} isAnimationActive={!REDUCED} activeDot={{ r: 4, fill: HEX.brand, stroke: "#0A0A0A", strokeWidth: 2 }} />
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

      {/* Planning summary — surfaces the Loading-screen data on the dashboard */}
      {(() => {
        const { machines = [], operations = [], machinePlan = [], components = [], settings = {} } = data;
        if (!machinePlan.length) return null; // nothing assigned to machines yet
        const targetHr = Number(settings.target_hr) || 2200;
        const activeM = machines.filter((m) => m.active !== false);
        const planned = activeM.filter((m) => machinePlan.some((l) => l.machine_id === m.id));
        const loads = planned.map((m) => { const d = machineLoadDays(m.id, machinePlan, operations); const cap = (m.working_days || 24) * ((m.shifts || 3) / 3); return { m, d, cap, pct: cap ? Math.round((d / cap) * 100) : 0 }; });
        const overbooked = loads.filter((x) => x.pct > 100).length;
        const avgPct = loads.length ? Math.round(loads.reduce((a, x) => a + x.pct, 0) / loads.length) : 0;
        const opsByComp = {}; for (const o of operations) (opsByComp[o.component_id] ||= []).push(o);
        let amt = 0, hrs = 0;
        for (const l of machinePlan) { const c = components.find((x) => x.id === l.component_id) || {}; const cap = componentCapacity(opsByComp[l.component_id] || [], l.qty); amt += (c.rate || 0) * l.qty; hrs += cap.total; }
        const hr = hrs > 0 ? amt / hrs : 0;
        const Card = ({ label, value, sub, tone }) => (
          <div className="rounded-lg bg-inset/50 border border-hair p-3.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim mb-1.5">{label}</div>
            <div className={`font-mono text-2xl font-bold tnum ${tone === "bad" ? "text-bad-ink" : tone === "ok" ? "text-ok-ink" : "text-ink"}`}>{value}</div>
            {sub && <div className="text-ink-dim text-[11px] font-mono mt-0.5">{sub}</div>}
          </div>
        );
        return (
          <Panel title="Capacity & Costing" tag="05" right={<span className="font-mono text-[11px] text-ink-dim">from the planning module</span>} className="mt-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card label="Machines planned" value={`${planned.length} / ${activeM.length}`} />
              <Card label="Avg machine load" value={`${avgPct}%`} tone={avgPct > 100 ? "bad" : "ok"} />
              <Card label="Overbooked" value={overbooked} tone={overbooked > 0 ? "bad" : "ok"} />
              <Card label="Hour-rate" value={inr(hr)} sub={`vs ${inr(targetHr)} target`} tone={hr >= targetHr ? "ok" : "bad"} />
            </div>
          </Panel>
        );
      })()}
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

          <LiquidButton onClick={open} disabled={!componentId} size="xl" className="group w-full text-base disabled:opacity-50 disabled:pointer-events-none">Record Output <ArrowRight size={20} className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1" /></LiquidButton>
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
                <m.button onClick={closeConfirm} disabled={saving} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 420, damping: 26, mass: 0.6 }} className={`${btnSecondary} flex-1 !py-3.5`}>Cancel</m.button>
                <m.button onClick={doSave} disabled={saving} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 420, damping: 26, mass: 0.6 }} className="flex-1 py-3.5 rounded-lg bg-gradient-to-b from-brand-300 to-brand-500 text-zinc-900 border-b-2 border-brand-700/70 ring-1 ring-inset ring-white/20 hover:brightness-110 active:brightness-95 font-semibold transition flex items-center justify-center gap-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22)] disabled:opacity-60 disabled:cursor-not-allowed">{saving ? "Saving…" : <><Check size={18} /> Confirm</>}</m.button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <m.div role="status" aria-live="polite" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="fixed bottom-5 right-5 z-50 bg-coal border border-hair rounded-[8px] shadow-pop px-4 py-3 flex items-center gap-3">
            <span className="w-5 h-5 rounded-full bg-ok grid place-items-center shrink-0"><Check size={13} className="text-[#0A0A0A]" /></span>
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
/* ------------------------------ Team (admin) ------------------------------ */
// Admin-only: add/deactivate operators & managers. All writes go through the
// admin-users Edge Function (which re-checks admin role server-side); the
// generated PIN/password is shown ONCE for the admin to hand out.
function CredentialReveal({ created, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!created) return null;
  const line = created.type === "operator"
    ? `${created.name} — Operator PIN: ${created.pin}`
    : `${created.name} — Manager · username: ${created.username} · password: ${created.password}`;
  const copy = async () => { try { await navigator.clipboard.writeText(line); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ } };
  return (
    <m.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
      <div className="rounded-[10px] border border-ok/40 bg-ok-soft p-4">
        <div className="flex items-center gap-2 mb-2"><Check size={16} className="text-ok-ink" /><span className="font-display font-semibold text-sm text-ink">{created.name} added — save this login now</span></div>
        <div className="flex items-center gap-2 flex-wrap">
          {created.type === "operator" ? (
            <span className="font-mono text-lg font-bold text-ink tnum">PIN {created.pin}</span>
          ) : (
            <span className="font-mono text-sm text-ink"><b>{created.username}</b> · <span className="select-all">{created.password}</span></span>
          )}
          <button onClick={copy} className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-inset border border-hair text-ink-soft hover:text-ink hover:border-brand-500/40 transition">{copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}</button>
        </div>
        <div className="text-[12px] text-ink-soft mt-2">This won't be shown again — give it to {created.name}, then dismiss.</div>
        <button onClick={onClose} className="mt-3 text-[12px] font-semibold text-ink-dim hover:text-ink underline underline-offset-2">Dismiss</button>
      </div>
    </m.div>
  );
}

function TeamAdmin({ user }) {
  const [users, setUsers] = useState(null); // null = loading
  const [err, setErr] = useState("");
  const [created, setCreated] = useState(null);
  const [opName, setOpName] = useState(""); const [opBusy, setOpBusy] = useState(false);
  const [mgName, setMgName] = useState(""); const [mgUser, setMgUser] = useState(""); const [mgRole, setMgRole] = useState("supervisor"); const [mgBusy, setMgBusy] = useState(false);
  const [toggle, setToggle] = useState(null); // user pending activate/deactivate confirm
  const [tBusy, setTBusy] = useState(false);

  const load = useCallback(async () => {
    try { setUsers(await db.adminListUsers()); } catch (e) { setErr(e.message || "Failed to load team"); setUsers([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const addOperator = async () => {
    if (!opName.trim() || opBusy) return;
    setOpBusy(true); setErr("");
    try { const r = await db.adminCreateOperator(opName.trim()); setCreated({ type: "operator", ...r }); setOpName(""); await load(); }
    catch (e) { setErr(e.message || "Failed to add operator"); }
    finally { setOpBusy(false); }
  };
  const addManager = async () => {
    if (!mgName.trim() || !mgUser.trim() || mgBusy) return;
    setMgBusy(true); setErr("");
    try { const r = await db.adminCreateManager({ name: mgName.trim(), username: mgUser.trim(), role: mgRole }); setCreated({ type: "manager", ...r }); setMgName(""); setMgUser(""); await load(); }
    catch (e) { setErr(e.message || "Failed to add manager"); }
    finally { setMgBusy(false); }
  };
  const confirmToggle = async () => {
    if (!toggle || tBusy) return;
    setTBusy(true); setErr("");
    try { await db.adminSetActive(toggle.id, !toggle.active); await load(); setToggle(null); }
    catch (e) { setErr(e.message || "Failed to update"); }
    finally { setTBusy(false); }
  };

  const operators = (users || []).filter((u) => u.role === "operator");
  const managers = (users || []).filter((u) => u.role !== "operator");

  return (
    <>
      <PageHead title="Team" sub="Add operators and managers · PINs and passwords are generated and shown once" />

      <div className="my-6"><AnimatePresence>{created && <CredentialReveal created={created} onClose={() => setCreated(null)} />}</AnimatePresence>
        <AnimatePresence>{err && <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div role="alert" className={`${errCls} mb-4`}><AlertTriangle size={15} className="shrink-0" />{err}</div></m.div>}</AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Add Operator" tag="01">
            <p className="text-ink-soft text-sm mb-4 -mt-1">Operators log in with a PIN. Just enter the name — a unique 4-digit PIN is generated.</p>
            <label className={labelCls} htmlFor="op-name">Operator name</label>
            <input id="op-name" value={opName} onChange={(e) => { setOpName(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && addOperator()} placeholder="e.g. Ravi Kumar" className={`${inputCls} mb-4`} />
            <MetalButton onClick={addOperator} disabled={!opName.trim() || opBusy} fullWidth className="disabled:opacity-50 disabled:pointer-events-none">{opBusy ? "Adding…" : <><Plus size={18} /> Add Operator</>}</MetalButton>
          </Panel>

          <Panel title="Add Manager" tag="02">
            <p className="text-ink-soft text-sm mb-4 -mt-1">Managers log in with a username + password (generated). Admins can manage the team; supervisors can't.</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className={labelCls} htmlFor="mg-name">Name</label><input id="mg-name" value={mgName} onChange={(e) => { setMgName(e.target.value); setErr(""); }} placeholder="e.g. Anita Rao" className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="mg-user">Username</label><input id="mg-user" value={mgUser} onChange={(e) => { setMgUser(e.target.value.toLowerCase()); setErr(""); }} placeholder="anita" className={inputCls} /></div>
            </div>
            <label className={labelCls}>Role</label>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {[["supervisor", "Supervisor"], ["admin", "Admin"]].map(([id, lbl]) => (
                <button key={id} onClick={() => setMgRole(id)} aria-pressed={mgRole === id} className={`min-h-[44px] py-2.5 rounded-lg border text-xs font-semibold transition active:scale-95 ${mgRole === id ? "border-brand-500 bg-brand-500/[0.10] text-brand-200 ring-1 ring-brand-500/30" : "border-hair bg-inset text-ink-soft hover:border-brand-500/40"}`}>{lbl}</button>
              ))}
            </div>
            <MetalButton onClick={addManager} disabled={!mgName.trim() || !mgUser.trim() || mgBusy} fullWidth className="disabled:opacity-50 disabled:pointer-events-none">{mgBusy ? "Adding…" : <><Plus size={18} /> Add Manager</>}</MetalButton>
          </Panel>
        </div>
      </div>

      <Panel title="Operators" tag="03" right={<span className="font-mono text-[11px] text-ink-dim">{operators.length} total</span>} className="mb-4">
        {users === null ? <div className="text-ink-dim text-sm py-6 text-center">Loading…</div>
          : operators.length === 0 ? <Empty msg="No operators yet — add your first one above." />
          : <ul className="divide-y divide-hair">
              {operators.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-3">
                  <span className={`font-semibold text-sm ${u.active ? "text-ink" : "text-ink-dim line-through"}`}>{u.name}</span>
                  <span className="font-mono text-xs text-ink-soft">PIN {u.login_code}</span>
                  {!u.active && <span className="font-mono text-[10px] uppercase tracking-wider text-ink-dim border border-hair rounded px-1.5 py-0.5">disabled</span>}
                  <button onClick={() => setToggle(u)} className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-inset border border-hair text-ink-soft hover:text-ink hover:border-brand-500/40 transition">{u.active ? "Deactivate" : "Reactivate"}</button>
                </li>
              ))}
            </ul>}
      </Panel>

      <Panel title="Managers" tag="04" right={<span className="font-mono text-[11px] text-ink-dim">{managers.length} total</span>}>
        {users === null ? <div className="text-ink-dim text-sm py-6 text-center">Loading…</div>
          : managers.length === 0 ? <Empty msg="No managers yet." />
          : <ul className="divide-y divide-hair">
              {managers.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-3">
                  <span className={`font-semibold text-sm ${u.active ? "text-ink" : "text-ink-dim line-through"}`}>{u.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-brand-300/80 border border-hair rounded px-1.5 py-0.5">{u.role}</span>
                  {u.id === user.id && <span className="font-mono text-[10px] uppercase tracking-wider text-ink-dim">you</span>}
                  {!u.active && <span className="font-mono text-[10px] uppercase tracking-wider text-ink-dim border border-hair rounded px-1.5 py-0.5">disabled</span>}
                  {u.id !== user.id && <button onClick={() => setToggle(u)} className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-inset border border-hair text-ink-soft hover:text-ink hover:border-brand-500/40 transition">{u.active ? "Deactivate" : "Reactivate"}</button>}
                </li>
              ))}
            </ul>}
      </Panel>

      <ConfirmDialog
        open={!!toggle}
        title={toggle?.active ? "Deactivate this person?" : "Reactivate this person?"}
        body={toggle ? <>{toggle.active ? <>This blocks <b className="text-ink">{toggle.name}</b> from logging in. Their history is kept and you can reactivate anytime.</> : <>This lets <b className="text-ink">{toggle.name}</b> log in again.</>}</> : null}
        confirmLabel={toggle?.active ? "Deactivate" : "Reactivate"}
        danger={toggle?.active}
        busy={tBusy}
        onConfirm={confirmToggle}
        onClose={() => { if (!tBusy) setToggle(null); }}
      />
    </>
  );
}

/* ----------------------------- Costing (Phase 5) -------------------------- */
// The sheet's costing block: per part — Amount (rate×qty), Hour-Rate vs the
// ₹2200 target, Targeted amount, Loss. Rolls up to the machine's overall HR.
function MachineCosting({ machine, lines, operations, components, reload, targetHr = TARGET_HR }) {
  const opsByComp = {};
  for (const o of operations || []) (opsByComp[o.component_id] ||= []).push(o);
  const compOf = (id) => (components || []).find((c) => c.id === id) || {};
  const setRate = async (id, v) => { try { await db.setComponentRate(id, parseFloat(v) || 0); await reload(); } catch { /* keep */ } };

  if (!lines.length) return null;
  let totAmount = 0, totHours = 0, totLoss = 0;
  const rows = lines.map((l) => {
    const c = compOf(l.component_id);
    const cap = componentCapacity(opsByComp[l.component_id] || [], l.qty);
    const cost = costing({ rate: c.rate || 0, qty: l.qty, hours: cap.total, targetHr });
    totAmount += cost.amount; totHours += cap.total; totLoss += cost.loss;
    return { l, c, hours: cap.total, ...cost };
  });
  const machineHr = totHours > 0 ? totAmount / totHours : 0;
  const hrTone = (hr) => hr >= targetHr ? "text-ok-ink" : hr >= targetHr * 0.8 ? "text-warn-ink" : "text-bad-ink";

  return (
    <Panel title="Costing" tag="05" right={<span className="font-mono text-[11px] text-ink-dim">target HR {inr(targetHr)}/hr</span>} className="mt-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 mb-4">
        <span className="text-ink-soft text-sm">Machine hour-rate:</span>
        <span className={`font-mono text-2xl font-bold tnum ${hrTone(machineHr)}`}>{inr(machineHr)}<span className="text-ink-dim text-sm">/hr</span></span>
        <span className="font-mono text-sm text-ink-soft">vs {inr(targetHr)} target</span>
        {totLoss > 0 && <span className="font-mono text-sm text-bad-ink">loss {inr(totLoss)}</span>}
      </div>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[680px]">
          <thead><tr className="text-left font-mono text-ink-dim text-[10px] font-semibold uppercase tracking-[0.14em] border-b border-hair">
            <th className="py-2.5 px-2">Part</th><th className="py-2.5 px-2 text-right">Qty</th><th className="py-2.5 px-2 text-right">Rate ₹/pc</th>
            <th className="py-2.5 px-2 text-right">Amount</th><th className="py-2.5 px-2 text-right">Hours</th><th className="py-2.5 px-2 text-right">HR ₹/hr</th>
            <th className="py-2.5 px-2 text-right">Targeted</th><th className="py-2.5 px-2 text-right">Loss</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.l.id} className="border-b border-hair last:border-0 hover:bg-white/[0.025]">
                <td className="py-2.5 px-2 font-semibold text-sm">{r.c.name}</td>
                <td className="py-2.5 px-2 text-right font-mono tnum">{r.l.qty}</td>
                <td className="py-2.5 px-2 text-right"><input type="number" min="0" defaultValue={r.c.rate || 0} onBlur={(e) => setRate(r.c.id, e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={`${cellCls} w-24`} /></td>
                <td className="py-2.5 px-2 text-right font-mono text-ink tnum">{inr(r.amount)}</td>
                <td className="py-2.5 px-2 text-right font-mono text-ink-soft tnum">{round1(r.hours)}</td>
                <td className={`py-2.5 px-2 text-right font-mono font-bold tnum ${hrTone(r.hr)}`}>{inr(r.hr)}</td>
                <td className="py-2.5 px-2 text-right font-mono text-ink-dim tnum">{inr(r.targeted)}</td>
                <td className={`py-2.5 px-2 text-right font-mono tnum ${r.loss > 0 ? "text-bad-ink" : "text-ink-dim"}`}>{r.loss > 0 ? inr(r.loss) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`${hintCls} mt-3`}><Check size={14} className="shrink-0 mt-0.5 text-ok-ink" /><span>Set each part's rate (₹ per piece). Amount = rate × qty; Hour-Rate = amount ÷ hours; Targeted = {inr(targetHr)} × hours; Loss = shortfall vs target. Green hour-rate means you're at or above your {inr(targetHr)} target.</span></div>
    </Panel>
  );
}

/* --------------------- Plan vs Actual (Phase 4) --------------------------- */
// The sheet's second "Actual" section: actual output (from shift entries) vs the
// plan, per part on the machine — qty, days, % complete, scrap.
function MachinePlanVsActual({ machine, lines, operations, components, entries }) {
  const opsByComp = {};
  for (const o of operations || []) (opsByComp[o.component_id] ||= []).push(o);
  const nameOf = (id) => (components || []).find((c) => c.id === id)?.name || "?";
  const actualFor = (cid) => (entries || []).filter((e) => e.component_id === cid && e.machine_id === machine.id)
    .reduce((a, e) => ({ qty: a.qty + (e.quantity || 0), scrap: a.scrap + (e.scrap_qty || 0) }), { qty: 0, scrap: 0 });

  if (!lines.length) return null;
  return (
    <Panel title="Plan vs Actual" tag="06" right={<span className="font-mono text-[11px] text-ink-dim">actuals from shift entries</span>} className="mt-4">
      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[640px]">
          <thead><tr className="text-left font-mono text-ink-dim text-[10px] font-semibold uppercase tracking-[0.14em] border-b border-hair">
            <th className="py-2.5 px-2">Part</th>
            <th className="py-2.5 px-2 text-right">Plan Qty</th><th className="py-2.5 px-2 text-right">Actual</th><th className="py-2.5 px-2 text-right">Variance</th>
            <th className="py-2.5 px-2 text-right">Plan Days</th><th className="py-2.5 px-2 text-right">Act Days</th>
            <th className="py-2.5 px-2 text-right">Scrap</th><th className="py-2.5 px-2 w-40">Progress</th>
          </tr></thead>
          <tbody>
            {lines.map((l) => {
              const ops = opsByComp[l.component_id] || [];
              const a = actualFor(l.component_id);
              const planDays = componentCapacity(ops, l.qty).days;
              const actDays = componentCapacity(ops, a.qty).days;
              const variance = a.qty - l.qty;
              const pct = l.qty ? Math.round((a.qty / l.qty) * 100) : 0;
              const tone = pct >= 100 ? "bg-ok text-ok-ink" : pct >= 60 ? "bg-warn text-warn-ink" : "bg-bad text-bad-ink";
              return (
                <tr key={l.id} className="border-b border-hair last:border-0 hover:bg-white/[0.025]">
                  <td className="py-2.5 px-2 font-semibold text-sm">{nameOf(l.component_id)}</td>
                  <td className="py-2.5 px-2 text-right font-mono tnum">{l.qty}</td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-ink tnum">{a.qty}</td>
                  <td className={`py-2.5 px-2 text-right font-mono tnum ${variance >= 0 ? "text-ok-ink" : "text-bad-ink"}`}>{variance > 0 ? "+" : ""}{variance}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-ink-soft tnum">{round1(planDays)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-ink-soft tnum">{round1(actDays)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-ink-dim tnum">{a.scrap || "—"}</td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-over overflow-hidden"><div className={`h-full ${tone.split(" ")[0]}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                      <span className={`font-mono text-xs font-bold tnum ${tone.split(" ")[1]}`}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={`${hintCls} mt-3`}><Check size={14} className="shrink-0 mt-0.5 text-ok-ink" /><span>Actual quantities come from operators' Shift Entry logs against this machine. Days recompute from the actual quantity using the same operation formulas.</span></div>
    </Panel>
  );
}

/* ------------------- Sheet view — the Excel replica ----------------------- */
// A full per-machine table that mirrors the HMC&VMC sheet columns end-to-end:
// Description, Opn, Cy/Set/Ins time, Plan Qty, MC/LB/Total/Eff hours, Total
// Days, Start/End date. Read-only report built from Phases 1-3 data.
function MachineSheet({ machine, lines, operations, components }) {
  const opsByComp = {};
  for (const o of operations || []) (opsByComp[o.component_id] ||= []).push(o);
  const sched = scheduleMachine(lines, opsByComp, curMonth());
  const nameOf = (id) => (components || []).find((c) => c.id === id)?.name || "?";

  // build full rows (hours breakdown per op) aligned with the schedule order
  const rows = sched.map((s) => {
    const op = (opsByComp[s.component_id] || []).find((o) => o.op_no === s.op_no) || {};
    const h = opHours({ qty: s.qty, cycle_time: op.cycle_time, setup_time: op.setup_time, insertion_time: op.insertion_time });
    return { name: nameOf(s.component_id), op_no: s.op_no, cy: op.cycle_time, set: op.setup_time, ins: op.insertion_time, qty: s.qty, ...h, start: s.start, end: s.end };
  });
  const tot = rows.reduce((a, r) => ({ mc: a.mc + r.mc, lb: a.lb + r.lb, total: a.total + r.total, eff: a.eff + r.eff, days: a.days + r.days }), { mc: 0, lb: 0, total: 0, eff: 0, days: 0 });

  // Phase 6: export this machine's sheet to a CSV (opens directly in Excel).
  const exportCsv = () => {
    const head = ["Description", "Opn", "Cycle(s)", "Setup(s)", "Ins(s)", "Plan Qty", "MC Hrs", "LB Hrs", "Total Hrs", "Eff Hrs", "Days", "Start", "End"];
    const body = rows.map((r) => [r.name, r.op_no, r.cy, r.set, r.ins, r.qty, round2(r.mc), round2(r.lb), round2(r.total), round2(r.eff), round2(r.days), fmtDate(r.start), fmtDate(r.end)]);
    body.push(["Total", "", "", "", "", "", round1(tot.mc), round1(tot.lb), round1(tot.total), round1(tot.eff), round1(tot.days), "", ""]);
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [["Machine", machine.name], ["Month", prettyMonth(curMonth())], [], head, ...body].map((row) => row.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${machine.name.replace(/\s+/g, "_")}-${curMonth()}-plan.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!rows.length) return <Panel title="Sheet — full plan" tag="04" className="mt-4"><Empty msg="Add parts with operations to see the full sheet." /></Panel>;

  const Th = ({ children, r }) => <th className={`py-2 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-dim ${r ? "text-right" : "text-left"} whitespace-nowrap`}>{children}</th>;
  const Td = ({ children, r, b }) => <td className={`py-2 px-2.5 text-[12px] ${r ? "text-right font-mono tnum" : ""} ${b ? "font-bold text-ink" : "text-ink-soft"} whitespace-nowrap`}>{children}</td>;

  return (
    <Panel title="Sheet — full plan" tag="04" right={
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline font-mono text-[11px] text-ink-dim">{machine.name} · {prettyMonth(curMonth())}</span>
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-inset border border-hair text-ink-soft hover:text-ink hover:border-brand-500/40 transition"><Copy size={13} /> Export Excel</button>
      </div>
    } className="mt-4">
      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[860px] border-collapse">
          <thead><tr className="border-b border-hair-strong">
            <Th>Description</Th><Th r>Opn</Th><Th r>Cy.s</Th><Th r>Set.s</Th><Th r>Ins.s</Th><Th r>Plan Qty</Th>
            <Th r>MC Hrs</Th><Th r>LB Hrs</Th><Th r>Total</Th><Th r>Eff</Th><Th r>Days</Th><Th r>Start</Th><Th r>End</Th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-hair last:border-0 hover:bg-white/[0.02]">
                <Td b>{r.name}</Td><Td r b>{r.op_no}</Td><Td r>{round1(r.cy)}</Td><Td r>{round1(r.set)}</Td><Td r>{round1(r.ins)}</Td><Td r b>{r.qty}</Td>
                <Td r>{round2(r.mc)}</Td><Td r>{round2(r.lb)}</Td><Td r>{round2(r.total)}</Td><Td r>{round2(r.eff)}</Td>
                <Td r b><span className="text-brand-300">{round2(r.days)}</span></Td>
                <Td r>{fmtDate(r.start)}</Td><Td r>{fmtDate(r.end)}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t-2 border-hair-strong">
            <Td b>Total</Td><Td r /><Td r /><Td r /><Td r /><Td r /><Td r b>{round1(tot.mc)}</Td><Td r b>{round1(tot.lb)}</Td><Td r b>{round1(tot.total)}</Td><Td r b>{round1(tot.eff)}</Td><Td r b><span className="text-brand-300">{round1(tot.days)}</span></Td><Td r /><Td r />
          </tr></tfoot>
        </table>
      </div>
      <div className={`${hintCls} mt-3`}><Check size={14} className="shrink-0 mt-0.5 text-ok-ink" /><span>This is your HMC&amp;VMC plan sheet, computed live from the parts, operations and quantities — same columns, same formulas. (Costing columns and the Actual section come in the next phases.)</span></div>
    </Panel>
  );
}

/* ------------------------ Machine Schedule (Phase 3) ---------------------- */
// Auto start/end dates per operation (sequential, Sundays off) + a month
// timeline, mirroring the Start Date / End Date columns in the sheets.
function MachineSchedule({ machine, lines, operations, components }) {
  const opsByComp = {};
  for (const o of operations || []) (opsByComp[o.component_id] ||= []).push(o);
  const rows = scheduleMachine(lines, opsByComp, curMonth());
  const { first, last, totalMs } = monthBounds(curMonth());
  const nameOf = (id) => (components || []).find((c) => c.id === id)?.name || "?";

  if (!rows.length) {
    return <Panel title="Schedule" tag="03" className="mt-4"><Empty msg="Add parts (with operations defined) to see the auto-scheduled timeline." /></Panel>;
  }
  const span = rows.length ? { s: rows[0].start, e: rows[rows.length - 1].end } : null;
  // day ticks across the month (about 6)
  const ticks = [];
  for (let i = 0; i <= 5; i++) { const t = new Date(first.getTime() + (totalMs * i) / 5); ticks.push(t); }

  return (
    <Panel title="Schedule" tag="03" right={span ? <span className="font-mono text-[11px] text-ink-dim">{fmtDate(span.s)} → {fmtDate(span.e)}</span> : null} className="mt-4">
      {/* timeline header */}
      <div className="flex justify-between font-mono text-[10px] text-ink-dim mb-1 px-1">
        {ticks.map((t, i) => <span key={i}>{fmtDate(t)}</span>)}
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const left = Math.max(0, ((r.start.getTime() - first.getTime()) / totalMs) * 100);
          const width = Math.max(1.5, ((r.end.getTime() - r.start.getTime()) / totalMs) * 100);
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="w-40 shrink-0 truncate text-[12px]"><span className="font-semibold text-ink">{nameOf(r.component_id)}</span> <span className="font-mono text-ink-dim">op{r.op_no}</span></div>
              <div className="relative flex-1 h-6 rounded bg-inset/60 overflow-hidden">
                <div className="absolute top-0 h-full rounded bg-gradient-to-r from-brand-500/70 to-brand-400/60 border border-brand-400/40" style={{ left: `${Math.min(left, 98)}%`, width: `${Math.min(width, 100 - Math.min(left, 98))}%` }} title={`${fmtDate(r.start)} → ${fmtDate(r.end)} · ${round1(r.days)}d`} />
              </div>
              <div className="w-32 shrink-0 text-right font-mono text-[11px] text-ink-soft tnum">{fmtDate(r.start)}→{fmtDate(r.end)}</div>
            </div>
          );
        })}
      </div>
      <div className={`${hintCls} mt-3`}><Check size={14} className="shrink-0 mt-0.5 text-ok-ink" /><span>Operations run one after another on the machine (Sundays off), starting from the 1st. Dates auto-update when you change quantities or operations.</span></div>
    </Panel>
  );
}

/* --------------------- Machine Loading (Phase 2) -------------------------- */
// Per-machine monthly plan: assign parts + quantities to each machine; the app
// expands each over the part's operations (Phase 1) and rolls up the machine's
// total load in DAYS vs the working month — your one-tab-per-machine sheet.
const MACHINE_DAYS = 24; // working days/month (Sundays off), matches the sheets

function machineLoadDays(machineId, machinePlan, operations) {
  let days = 0;
  for (const l of (machinePlan || []).filter((x) => x.machine_id === machineId)) {
    const ops = (operations || []).filter((o) => o.component_id === l.component_id);
    days += componentCapacity(ops, l.qty).days;
  }
  return days;
}

function loadTone(pct) {
  return pct > 100 ? { text: "text-bad-ink", bar: "bg-bad", ring: "border-bad/40" }
    : pct >= 85 ? { text: "text-warn-ink", bar: "bg-warn", ring: "border-warn/30" }
    : { text: "text-ok-ink", bar: "bg-ok", ring: "border-hair" };
}

function MachineLoading({ data, reload }) {
  const { machines, components, operations, machinePlan } = data;
  const active = machines.filter((m) => m.active !== false);
  const activeComps = components.filter((c) => c.active !== false);
  const [selId, setSelId] = useState(active[0]?.id || "");
  const sel = active.find((m) => m.id === selId) || active[0];
  const [compId, setCompId] = useState(activeComps[0]?.id || "");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [delLine, setDelLine] = useState(null); const [delBusy, setDelBusy] = useState(false);

  if (!active.length) return <><PageHead title="Machine Loading" sub="Assign parts to machines and see capacity" /><div className="mt-6"><Empty msg="No machines yet. Seed your machines first." /></div></>;

  // Machine capacity in 3-shift-equivalent days: a 1-shift machine has 1/3 the
  // daily output, so its capacity = working_days × shifts/3 (matches the sheets).
  const wd = (m) => round1(((m && m.working_days) || MACHINE_DAYS) * (((m && m.shifts) || 3) / 3));
  const lines = (machinePlan || []).filter((l) => l.machine_id === sel.id);
  const selDays = machineLoadDays(sel.id, machinePlan, operations);
  const selCap = wd(sel);
  const selPct = selCap ? Math.round((selDays / selCap) * 100) : 0;
  const compName = (id) => components.find((c) => c.id === id)?.name || "?";
  const compOps = (id) => (operations || []).filter((o) => o.component_id === id);

  const addLine = async () => {
    if (busy || !compId || !qty) return; setBusy(true); setErr("");
    try { await db.addMachinePlanLine({ month: curMonth(), machine_id: sel.id, component_id: compId, qty: parseInt(qty, 10) || 0, seq: lines.length }); setQty(""); await reload(); }
    catch (e) { setErr(e.message || "Failed to add"); } finally { setBusy(false); }
  };
  const editQty = async (id, v) => { try { await db.updateMachinePlanLine(id, { qty: parseInt(v, 10) || 0 }); await reload(); } catch { /* keep */ } };
  const confirmDel = async () => { if (delBusy || !delLine) return; setDelBusy(true); try { await db.removeMachinePlanLine(delLine.id); await reload(); setDelLine(null); } catch { /* keep */ } finally { setDelBusy(false); } };

  return (
    <>
      <PageHead title="Machine Loading" sub={`${prettyMonth(curMonth())} · planned days vs ${MACHINE_DAYS}-day working month, per machine`} />

      {/* overview: every machine's load at a glance */}
      <Panel title="All Machines — load this month" tag="01" className="mt-6 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {active.map((m) => {
            const d = machineLoadDays(m.id, machinePlan, operations);
            const cap = wd(m);
            const pct = Math.round((d / cap) * 100);
            const tone = loadTone(pct);
            return (
              <button key={m.id} onClick={() => setSelId(m.id)} className={`text-left rounded-lg border ${m.id === sel.id ? "border-brand-500 bg-brand-500/[0.06]" : tone.ring + " bg-inset/50 hover:border-brand-500/40"} p-3 transition`}>
                <div className="font-semibold text-[13px] text-ink truncate">{m.name}</div>
                <div className="mt-1.5 flex items-baseline gap-1"><span className={`font-mono font-bold tnum ${tone.text}`}>{round1(d)}</span><span className="font-mono text-[11px] text-ink-dim">/ {cap}d</span></div>
                <div className="mt-1.5 h-1.5 rounded-full bg-over overflow-hidden"><div className={`h-full ${tone.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                {pct > 100 && <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-bad-ink">over by {round1(d - cap)}d</div>}
              </button>
            );
          })}
        </div>
      </Panel>

      {/* selected machine's plan */}
      <Panel title={`Plan — ${sel.name}`} tag="02" right={
        <select value={selId} onChange={(e) => setSelId(e.target.value)} className="bg-inset border border-hair rounded-lg text-sm text-ink px-3 py-2 font-semibold outline-none focus:border-brand-500 max-w-[180px]">
          {active.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      }>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4">
          <span className="text-ink-soft text-sm">Total load:</span>
          <span className={`font-mono text-2xl font-bold tnum ${loadTone(selPct).text}`}>{round1(selDays)}<span className="text-ink-dim text-base"> / {selCap} days</span></span>
          <div className="flex-1 min-w-[120px] max-w-[280px] h-2 rounded-full bg-over overflow-hidden"><div className={`h-full ${loadTone(selPct).bar}`} style={{ width: `${Math.min(selPct, 100)}%` }} /></div>
          <span className={`font-mono text-sm font-bold ${loadTone(selPct).text}`}>{selPct}%</span>
        </div>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[520px]">
            <thead><tr className="text-left font-mono text-ink-dim text-[10px] font-semibold uppercase tracking-[0.14em] border-b border-hair">
              <th className="py-2.5 px-2">Part</th><th className="py-2.5 px-2 text-right">Qty</th><th className="py-2.5 px-2 text-right">Ops</th><th className="py-2.5 px-2 text-right">Days</th><th className="py-2.5 px-2 w-10" />
            </tr></thead>
            <tbody>
              {lines.length === 0 ? <tr><td colSpan={5} className="py-5"><Empty msg={`Nothing planned on ${sel.name} yet — add a part below.`} /></td></tr>
                : lines.map((l) => {
                  const ops = compOps(l.component_id);
                  const d = componentCapacity(ops, l.qty).days;
                  return (
                    <tr key={l.id} className="border-b border-hair last:border-0 hover:bg-white/[0.025] transition">
                      <td className="py-2.5 px-2 font-semibold text-sm">{compName(l.component_id)}</td>
                      <td className="py-2.5 px-2 text-right"><input type="number" min="0" defaultValue={l.qty} onBlur={(e) => editQty(l.id, e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={`${cellCls} w-24`} /></td>
                      <td className="py-2.5 px-2 text-right font-mono text-sm tnum">{ops.length === 0 ? <span className="text-warn-ink" title="No operations defined for this part — define them in Plan Setup → Routing">none</span> : ops.length}</td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-brand-300 tnum">{round1(d)}</td>
                      <td className="py-2.5 px-2"><button onClick={() => setDelLine(l)} aria-label="Remove" className="p-2 min-h-[40px] min-w-[40px] grid place-items-center rounded-lg text-ink-dim hover:bg-white/[0.06] hover:text-bad-ink transition"><Trash2 size={14} /></button></td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
          <div className="sm:col-span-2"><label className={labelCls}>Part</label>
            <select value={compId} onChange={(e) => { setCompId(e.target.value); setErr(""); }} className={inputCls}>
              {activeComps.map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` · ${c.code}` : ""}</option>)}
            </select>
          </div>
          <div className="flex gap-2.5 items-end">
            <div className="flex-1"><label className={labelCls}>Qty</label><input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="140" className={inputCls} /></div>
            <MetalButton onClick={addLine} disabled={!compId || !qty || busy} className="disabled:opacity-50 disabled:pointer-events-none">{busy ? "…" : <><Plus size={16} /> Add</>}</MetalButton>
          </div>
        </div>
        {err && <div role="alert" className={`${errCls} mt-3`}><AlertTriangle size={15} className="shrink-0" />{err}</div>}
        <div className={`${hintCls} mt-3`}><Check size={14} className="shrink-0 mt-0.5 text-ok-ink" /><span>Each part's days come from its operations (Plan Setup → Routing). If a part shows "none" ops, define its operations there first. Over 100% means the machine is overbooked for the month.</span></div>
      </Panel>

      {/* Phase 3: auto schedule — operations sequenced with start/end dates */}
      <MachineSchedule machine={sel} lines={lines} operations={operations} components={components} />

      {/* Excel replica — the full plan sheet */}
      <MachineSheet machine={sel} lines={lines} operations={operations} components={components} />

      {/* Phase 5: costing (hour-rate vs target) */}
      <MachineCosting machine={sel} lines={lines} operations={operations} components={components} reload={reload} targetHr={Number(data.settings?.target_hr) || TARGET_HR} />

      {/* Phase 4: plan vs actual (the sheet's Actual section) */}
      <MachinePlanVsActual machine={sel} lines={lines} operations={operations} components={components} entries={data.entries} />

      <ConfirmDialog open={!!delLine} title="Remove from machine plan?" body={delLine ? <>Remove <b className="text-ink">{compName(delLine.component_id)}</b> from {sel.name}'s plan?</> : null} confirmLabel="Remove" danger busy={delBusy} onConfirm={confirmDel} onClose={() => { if (!delBusy) setDelLine(null); }} />
    </>
  );
}

// In-app Excel import: read an HMC&VMC .xls, pull each part's operations, match
// to components, preview, apply. SheetJS is lazy-loaded so it never bloats the
// main bundle.
function ExcelImport({ data, reload }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");

  const matchComp = (desc, comps) => {
    const d = (desc || "").toLowerCase();
    for (const c of comps) if (c.code && d.includes(String(c.code).toLowerCase())) return c;
    for (const c of comps) {
      const toks = (c.name || "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3);
      if (toks.some((t) => d.includes(t))) return c;
    }
    return null;
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(""); setDone(""); setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const comps = (data.components || []).filter((c) => c.active !== false);
      const yr = String(new Date().getFullYear());
      const found = {};
      for (const name of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" });
        const headText = rows.slice(0, 4).flat().join(" ");
        if (!/production plan/i.test(headText) || (!headText.includes(yr) && !/202\d/.test(headText))) continue;
        // only current-year sheets (skip stale tabs)
        if (!new RegExp(yr).test(headText)) continue;
        for (const r of rows) {
          const desc = String(r[5] || "").trim();
          const opno = Number(r[6]); const cy = Number(r[7]); const st = Number(r[8]); const ins = Number(r[9]) || 60;
          if (!desc || !Number.isFinite(opno) || opno <= 0 || !Number.isFinite(cy)) continue;
          if (/descrip|pallet|shift/i.test(desc)) continue;
          const c = matchComp(desc, comps);
          const key = c ? `${c.id}|${opno}` : `?${desc}|${opno}`;
          found[key] = { desc, op_no: opno, cycle: cy, setup: st || 0, ins, comp: c };
        }
      }
      const list = Object.values(found).sort((a, b) => (a.comp?.name || a.desc).localeCompare(b.comp?.name || b.desc) || a.op_no - b.op_no);
      if (!list.length) { setErr("No operation rows found in a current-year plan sheet. Is this the HMC&VMC plan file?"); }
      else setPreview({ list, matched: list.filter((x) => x.comp).length, unmatched: list.filter((x) => !x.comp).length });
    } catch (ex) { setErr("Could not read the file: " + (ex.message || ex)); }
    finally { setBusy(false); e.target.value = ""; }
  };

  const apply = async () => {
    if (!preview || busy) return;
    setBusy(true); setErr("");
    let n = 0;
    try {
      for (const o of preview.list) {
        if (!o.comp) continue;
        const ex = (data.operations || []).find((x) => x.component_id === o.comp.id && Number(x.op_no) === o.op_no);
        if (ex) await db.updateOperation(ex.id, { cycle_time: o.cycle, setup_time: o.setup, insertion_time: o.ins });
        else await db.addOperation({ component_id: o.comp.id, op_no: o.op_no, cycle_time: o.cycle, setup_time: o.setup, insertion_time: o.ins });
        n++;
      }
      setDone(`Imported ${n} operations from your Excel.`); setPreview(null); await reload();
    } catch (ex) { setErr("Import failed: " + (ex.message || ex)); }
    finally { setBusy(false); }
  };

  return (
    <Panel title="Import from Excel" tag="06" className="mt-4">
      <p className="text-ink-soft text-sm mb-3 -mt-1">Upload your HMC&amp;VMC .xls — the app reads each part's operations (op no, cycle, setup, insertion time) from the current-year plan sheets and fills them in, matching parts by code or name.</p>
      <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-semibold px-4 py-2.5 rounded-lg bg-inset border border-hair-strong text-ink hover:border-brand-500/40 transition">
        <input type="file" accept=".xls,.xlsx" onChange={onFile} className="hidden" disabled={busy} />
        {busy && !preview ? "Reading…" : "Choose .xls file"}
      </label>
      {err && <div role="alert" className={`${errCls} mt-3`}><AlertTriangle size={15} className="shrink-0" />{err}</div>}
      {done && <div className={`${hintCls} mt-3`}><Check size={14} className="text-ok-ink shrink-0 mt-0.5" /><span>{done}</span></div>}
      {preview && (
        <div className="mt-4">
          <div className="text-sm text-ink-soft mb-2"><b className="text-ink">{preview.matched}</b> operations matched to your parts{preview.unmatched ? `, ${preview.unmatched} unmatched (will be skipped)` : ""}:</div>
          <div className="max-h-56 overflow-y-auto border border-hair rounded-lg">
            <table className="w-full text-[12px]">
              <tbody>
                {preview.list.map((o, i) => (
                  <tr key={i} className="border-b border-hair last:border-0">
                    <td className="py-1.5 px-2.5 font-semibold">{o.comp ? o.comp.name : <span className="text-warn-ink">{o.desc} · no match</span>}</td>
                    <td className="py-1.5 px-2.5 font-mono text-ink-dim">op{o.op_no}</td>
                    <td className="py-1.5 px-2.5 font-mono text-right text-ink-soft tnum">cy {o.cycle} · set {o.setup}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MetalButton onClick={apply} disabled={busy || !preview.matched} className="mt-3 disabled:opacity-50 disabled:pointer-events-none">{busy ? "Importing…" : <><Plus size={16} /> Import {preview.matched} operations</>}</MetalButton>
        </div>
      )}
    </Panel>
  );
}

// Editable settings: target hour-rate + per-machine working days / shifts.
function SettingsPanel({ data, reload }) {
  const machines = (data.machines || []).filter((m) => m.active !== false);
  const [hr, setHr] = useState(String(data.settings?.target_hr || "2200"));
  const [saved, setSaved] = useState(false);
  const saveHr = async () => { try { await db.setSetting("target_hr", parseInt(hr, 10) || 2200); setSaved(true); setTimeout(() => setSaved(false), 1500); await reload(); } catch { /* keep */ } };
  const saveMachine = async (id, field, v) => { try { await db.setMachine(id, { [field]: Math.max(field === "shifts" ? 1 : 1, parseInt(v, 10) || 1) }); await reload(); } catch { /* keep */ } };

  return (
    <Panel title="Settings — capacity & costing" tag="05" className="mt-4">
      <div className="max-w-sm mb-6">
        <label className={labelCls}>Target hour-rate (₹/hr)</label>
        <div className="flex gap-2">
          <input type="number" min="0" value={hr} onChange={(e) => setHr(e.target.value)} className={inputCls} />
          <MetalButton onClick={saveHr} className="shrink-0">{saved ? <><Check size={16} /> Saved</> : "Save"}</MetalButton>
        </div>
        <p className="text-ink-dim text-xs mt-1.5">Your hour-rate goal — the Costing screen colours each part green at or above it.</p>
      </div>

      <label className={labelCls}>Per-machine working days &amp; shifts</label>
      <div className="overflow-x-auto -mx-1 mt-1">
        <table className="w-full min-w-[420px]">
          <thead><tr className="text-left font-mono text-ink-dim text-[10px] font-semibold uppercase tracking-[0.14em] border-b border-hair">
            <th className="py-2.5 px-2">Machine</th><th className="py-2.5 px-2 text-right">Working days</th><th className="py-2.5 px-2 text-right">Shifts</th>
          </tr></thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id} className="border-b border-hair last:border-0">
                <td className="py-2 px-2 font-semibold text-sm">{m.name}</td>
                <td className="py-2 px-2 text-right"><input type="number" min="1" defaultValue={m.working_days || 24} onBlur={(e) => saveMachine(m.id, "working_days", e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={`${cellCls} w-20`} /></td>
                <td className="py-2 px-2 text-right"><input type="number" min="1" max="3" defaultValue={m.shifts || 3} onBlur={(e) => saveMachine(m.id, "shifts", e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={`${cellCls} w-16`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`${hintCls} mt-3`}><Check size={14} className="shrink-0 mt-0.5 text-ok-ink" /><span>Working days set each machine's monthly capacity on the Loading screen (default 24, Sundays off). Edit a value and click away to save.</span></div>
    </Panel>
  );
}

// Phase 1: Routing & Capacity — define each part's operations (op no, cycle,
// setup, insertion time) and see the machine/labour hours and DAYS computed with
// Akilan's exact Excel formulas. The day count is what drives capacity planning.
function OperationsPanel({ data, reload }) {
  const { components, plans, operations } = data;
  const active = components.filter((c) => c.active !== false);
  const [selId, setSelId] = useState(active[0]?.id || "");
  const sel = active.find((c) => c.id === selId) || active[0];
  const planFor = (cid) => plans.find((p) => p.component_id === cid);

  const [opNo, setOpNo] = useState(""); const [desc, setDesc] = useState("");
  const [cyc, setCyc] = useState(""); const [setup, setSetup] = useState(""); const [ins, setIns] = useState("60");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [delOp, setDelOp] = useState(null); const [delBusy, setDelBusy] = useState(false);

  if (!sel) return <Panel title="Routing & Capacity" tag="04"><Empty msg="Add a component above first, then define its operations here." /></Panel>;

  const ops = (operations || []).filter((o) => o.component_id === sel.id).sort((a, b) => a.op_no - b.op_no);
  const qty = planFor(sel.id)?.target_qty ?? 0;
  const wd = planFor(sel.id)?.working_days ?? 24;
  const cap = componentCapacity(ops, qty);

  const addOp = async () => {
    if (busy || !opNo) return; setBusy(true); setErr("");
    try {
      await db.addOperation({ component_id: sel.id, op_no: parseInt(opNo, 10), description: desc.trim(), cycle_time: parseFloat(cyc) || 0, setup_time: parseFloat(setup) || 0, insertion_time: parseFloat(ins) || 0 });
      setOpNo(""); setDesc(""); setCyc(""); setSetup(""); setIns("60"); await reload();
    } catch (e) { setErr(e.message || "Failed to add operation"); }
    finally { setBusy(false); }
  };
  const editField = async (id, field, value) => {
    const v = field === "description" ? value : (parseFloat(value) || 0);
    try { await db.updateOperation(id, { [field]: v }); await reload(); } catch { /* keep value */ }
  };
  const confirmDel = async () => {
    if (delBusy || !delOp) return; setDelBusy(true);
    try { await db.removeOperation(delOp.id); await reload(); setDelOp(null); }
    catch { /* keep dialog */ } finally { setDelBusy(false); }
  };

  return (
    <Panel title="Routing & Capacity" tag="04" right={
      <select value={selId} onChange={(e) => setSelId(e.target.value)} className="bg-inset border border-hair rounded-lg text-sm text-ink px-3 py-2 font-semibold outline-none focus:border-brand-500 max-w-[200px]">
        {active.map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` · ${c.code}` : ""}</option>)}
      </select>
    }>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 mb-4 text-sm">
        <span className="text-ink-soft">Capacity for <b className="text-ink">{sel.name}</b> at <b className="text-ink font-mono tnum">{qty}</b> pcs:</span>
        <span className="font-mono text-ink-soft">MC <b className="text-ink tnum">{round1(cap.mc)}</b>h</span>
        <span className="font-mono text-ink-soft">LB <b className="text-ink tnum">{round1(cap.lb)}</b>h</span>
        <span className="font-mono text-ink-soft">Eff <b className="text-ink tnum">{round1(cap.eff)}</b>h</span>
        <span className={`font-mono font-bold tnum ${cap.days > wd ? "text-bad-ink" : "text-ok-ink"}`}>{round1(cap.days)} days{cap.days > wd ? ` · over ${wd}!` : ` / ${wd}`}</span>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[680px]">
          <thead><tr className="text-left font-mono text-ink-dim text-[10px] font-semibold uppercase tracking-[0.14em] border-b border-hair">
            <th className="py-2.5 px-2">Op</th><th className="py-2.5 px-2">Description</th>
            <th className="py-2.5 px-2 text-right">Cycle (s)</th><th className="py-2.5 px-2 text-right">Setup (s)</th><th className="py-2.5 px-2 text-right">Ins (s)</th>
            <th className="py-2.5 px-2 text-right">MC h</th><th className="py-2.5 px-2 text-right">Eff h</th><th className="py-2.5 px-2 text-right">Days</th><th className="py-2.5 px-2 w-10" />
          </tr></thead>
          <tbody>
            {ops.length === 0 ? <tr><td colSpan={9} className="py-5"><Empty msg={`No operations for ${sel.name} yet — add the first below.`} /></td></tr>
              : ops.map((o) => {
                const h = opHours({ qty, cycle_time: o.cycle_time, setup_time: o.setup_time, insertion_time: o.insertion_time });
                return (
                  <tr key={o.id} className="border-b border-hair last:border-0 hover:bg-white/[0.025] transition">
                    <td className="py-2.5 px-2"><input type="number" defaultValue={o.op_no} onBlur={(e) => editField(o.id, "op_no", e.target.value)} className={`${cellCls} w-16`} /></td>
                    <td className="py-2.5 px-2"><input defaultValue={o.description || ""} placeholder="—" onBlur={(e) => editField(o.id, "description", e.target.value)} className="w-full min-w-[120px] px-2.5 py-2 bg-inset border border-hair-strong rounded-lg text-ink text-sm outline-none focus:border-brand-500" /></td>
                    <td className="py-2.5 px-2 text-right"><input type="number" defaultValue={o.cycle_time} onBlur={(e) => editField(o.id, "cycle_time", e.target.value)} className={`${cellCls} w-20`} /></td>
                    <td className="py-2.5 px-2 text-right"><input type="number" defaultValue={o.setup_time} onBlur={(e) => editField(o.id, "setup_time", e.target.value)} className={`${cellCls} w-20`} /></td>
                    <td className="py-2.5 px-2 text-right"><input type="number" defaultValue={o.insertion_time} onBlur={(e) => editField(o.id, "insertion_time", e.target.value)} className={`${cellCls} w-16`} /></td>
                    <td className="py-2.5 px-2 text-right font-mono text-ink-soft tnum">{round2(h.mc)}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-ink-soft tnum">{round2(h.eff)}</td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-brand-300 tnum">{round2(h.days)}</td>
                    <td className="py-2.5 px-2"><button onClick={() => setDelOp(o)} aria-label={`Remove operation ${o.op_no}`} className="p-2 min-h-[40px] min-w-[40px] grid place-items-center rounded-lg text-ink-dim hover:bg-white/[0.06] hover:text-bad-ink transition"><Trash2 size={14} /></button></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* add operation */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end">
        <div><label className={labelCls}>Op No</label><input type="number" value={opNo} onChange={(e) => { setOpNo(e.target.value); setErr(""); }} placeholder="40" className={inputCls} /></div>
        <div className="col-span-2 sm:col-span-1"><label className={labelCls}>Description</label><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Rough mill" className={inputCls} /></div>
        <div><label className={labelCls}>Cycle (s)</label><input type="number" value={cyc} onChange={(e) => setCyc(e.target.value)} placeholder="28" className={inputCls} /></div>
        <div><label className={labelCls}>Setup (s)</label><input type="number" value={setup} onChange={(e) => setSetup(e.target.value)} placeholder="56" className={inputCls} /></div>
        <div><label className={labelCls}>Ins (s)</label><input type="number" value={ins} onChange={(e) => setIns(e.target.value)} placeholder="60" className={inputCls} /></div>
        <MetalButton onClick={addOp} disabled={!opNo || busy} fullWidth className="disabled:opacity-50 disabled:pointer-events-none">{busy ? "…" : <><Plus size={16} /> Add Op</>}</MetalButton>
      </div>
      {err && <div role="alert" className={`${errCls} mt-3`}><AlertTriangle size={15} className="shrink-0" />{err}</div>}
      <div className={`${hintCls} mt-3`}><Check size={14} className="shrink-0 mt-0.5 text-ok-ink" /><span>Hours and days use your exact sheet formula: MC = (qty×cycle + setup + ins)/60, LB = MC/12, Eff = total×1.05, Days = Eff/17. Edit any cell and click away to save.</span></div>

      <ConfirmDialog open={!!delOp} title="Remove this operation?" body={delOp ? <>Remove <b className="text-ink">Op {delOp.op_no}</b>{delOp.description ? ` (${delOp.description})` : ""} from {sel.name}'s routing?</> : null} confirmLabel="Remove operation" danger busy={delBusy} onConfirm={confirmDel} onClose={() => { if (!delBusy) setDelOp(null); }} />
    </Panel>
  );
}

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
          <MetalButton onClick={addComponent} disabled={!name.trim() || adding} fullWidth className="disabled:opacity-50 disabled:pointer-events-none">{adding ? "Adding…" : <><Plus size={18} /> Add Component</>}</MetalButton>
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

      <div className="mt-4"><OperationsPanel data={data} reload={reload} /></div>
      <SettingsPanel data={data} reload={reload} />
      <ExcelImport data={data} reload={reload} />

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
// Tactile premium button — gradient fill + inset white ring + darker bottom border
// + soft brand glow; press = brightness + 1px settle. (Instrument-grade, no gimmick.)
const btnPrimary = "group relative w-full py-3.5 rounded-lg bg-gradient-to-b from-brand-300 to-brand-500 text-zinc-900 font-semibold text-[15px] flex items-center justify-center gap-2 border border-b-2 border-brand-700/70 ring-1 ring-inset ring-white/20 shadow-[0_4px_14px_-3px_rgba(0,0,0,0.55)] transition-[filter,transform] duration-200 hover:brightness-110 active:brightness-95 active:translate-y-px";
// Two tiers keep blue on the CTA only: primary = solid brand (btnPrimary);
// secondary = neutral inset + ring, brand showing ONLY on hover (non-CTA actions).
const btnSecondary = "min-h-[44px] px-4 py-3 rounded-lg bg-gradient-to-b from-inset to-[#1c1c21] text-ink font-semibold text-sm flex items-center justify-center gap-2 border border-b-2 border-black/40 ring-1 ring-inset ring-white/[0.07] transition-[filter,transform] duration-200 hover:brightness-115 active:brightness-95 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none";
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
              <m.button onClick={onClose} disabled={busy} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 420, damping: 26, mass: 0.6 }} className={`${btnSecondary} flex-1 !py-3.5`}>Cancel</m.button>
              <div className="flex-1">
                <MetalButton onClick={onConfirm} disabled={busy} fullWidth variant={danger ? "error" : "default"} className="disabled:opacity-60 disabled:cursor-not-allowed">{busy ? "Working…" : confirmLabel}</MetalButton>
              </div>
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
        <div className="mt-3.5"><Meter pct={pct} level={pctNeutral ? null : subLevel} color={pctNeutral ? "#71717A" : undefined} height="h-1.5" ticks /></div>
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

// Decorative corner tick (a small "+") used on the glance banner and empty
// states — purely ornamental, hidden from AT.
const Crosshair = ({ className = "" }) => (
  <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" className={`text-ink-dim/60 ${className}`}>
    <path d="M5 0v10M0 5h10" stroke="currentColor" strokeWidth="1" />
  </svg>
);

const Empty = ({ msg }) => (
  <div className="relative overflow-hidden rounded-lg bg-inset/50 border border-hair py-10 px-5 text-center">
    <Crosshair className="absolute top-3 left-3" />
    <Crosshair className="absolute bottom-3 right-3" />
    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim mb-2">No data</div>
    <div className="text-ink-soft text-sm max-w-xs mx-auto">{msg}</div>
  </div>
);
