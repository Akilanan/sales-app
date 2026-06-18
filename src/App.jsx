import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { m, AnimatePresence } from "framer-motion";
import NumberFlow from "@number-flow/react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area, ReferenceLine, LabelList,
} from "recharts";
import {
  SquaresFour as LayoutDashboard, ClipboardText as ClipboardList,
  SlidersHorizontal as Settings2, UsersThree as Users, Gauge, Copy, Plus, Trash as Trash2, Check, SignOut as LogOut, X, PencilSimple, ArrowsClockwise, CaretUp, CaretDown,
  TrendUp as TrendingUp, TrendDown as TrendingDown, Clock, ArrowRight,
  Warning as AlertTriangle, ShieldCheck, Backspace as Delete, Minus, Eye, EyeSlash,
} from "@phosphor-icons/react";
import { db, seedIfEmpty, MODE, CONFIG_ERROR } from "./lib/db";
import ScrollExpandMedia from "./components/ui/ScrollExpandMedia";
import { LiquidButton, MetalButton } from "./components/ui/buttons";
import { NavBar } from "./components/ui/tubelight-navbar";
import { opHours, componentCapacity, round1, round2, costing, inr, TARGET_HR } from "./lib/capacity";
import { scheduleMachine, monthBounds, fmtDate } from "./lib/schedule";
import { suggestMachines, suggestSplit, isDown, allowedMachines, isAllowedOn, machineCapacityDays } from "./lib/loadability";
import { spring, ease, dur, tween, exitTween } from "./lib/motion";
import { LOW_POWER } from "./lib/power";

/* ============================================================================
   PRANA VENTURE — MONOCHROME instrument console. Near-black zinc shell, white/
   silver type, NO colour accents — brightness encodes urgency (white = critical).
   Depth via layered edge-light shadows + a faint overhead glow + film grain.
   Motion tuned for "instrument" feel (see lib/motion.js): fast, low-bounce.
============================================================================ */

const REDUCED = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The 3D hero is heavy (three.js) — code-split it so it never blocks first paint.
const Ambient = lazy(() => import("./lib/Ambient"));

// If WebGL throws (lost context, no GPU, driver crash) the hero must degrade to
// the black panel, never a blank/broken login.
class HeroErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — the black panel carries the hero */ }
  render() { return this.state.failed ? null : this.props.children; }
}

// HeroScene — UNWIRED (kept for cheap reversal): the robot now sits on pure
// black per the original splite demo; the spindle/ember layer (lib/Ambient.jsx)
// stays on disk. To restore, delete the early `return null`.
function HeroScene() {
  return null;
  // eslint-disable-next-line no-unreachable
  if (REDUCED || LOW_POWER) return null;
  return (
    <HeroErrorBoundary>
      <Suspense fallback={null}>
        <Ambient status="ok" />
      </Suspense>
    </HeroErrorBoundary>
  );
}

// Single-source ambient glow behind the shell — a faint overhead light that lifts
// the canvas off pure black. MONOCHROME (white at low alpha), pointer-transparent.
function StaticGlow({ variant = "ambient" }) {
  const bg = variant === "hero"
    ? "radial-gradient(58% 52% at 66% 32%, rgba(255,255,255,0.05), transparent 70%), radial-gradient(48% 44% at 14% 98%, rgba(255,255,255,0.025), transparent 72%)"
    : "radial-gradient(46% 42% at 84% 18%, rgba(255,255,255,0.035), transparent 72%)";
  return <div className={`${variant === "hero" ? "absolute" : "fixed"} inset-0 pointer-events-none`} style={{ zIndex: 0, background: bg }} aria-hidden="true" />;
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
// 'YYYY-MM' ± n months — powers the month switcher (history review / pre-planning).
const addMonths = (m, n) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
// Working days (Sundays off) in a month; `upTo` caps at a day-of-month (for "elapsed").
const workingDaysIn = (m, upTo = 31) => {
  const [y, mo] = m.split("-").map(Number);
  const days = new Date(y, mo, 0).getDate();
  let n = 0;
  for (let d = 1; d <= Math.min(days, upTo); d++) if (new Date(y, mo - 1, d).getDay() !== 0) n++;
  return n;
};

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
// axis lifted #71717A→#8A8A94 so 11px chart tick labels clear WCAG AA (matches the
// ink.dim token fix). All values monochrome — charts encode urgency via brightness.
const HEX = { brand: "#FAFAFA", grid: "rgba(255,255,255,0.07)", ghost: "rgba(255,255,255,0.12)", axis: "#8A8A94", axis2: "#A1A1AA" };
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
const itemV = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: tween(dur.hero, ease.emphasis) } };
// Directional view swap — content slides FROM the side the new tab sits on
// (matching the tubelight lamp's travel), exits run 20% faster via exitTween.
const viewV = {
  enter: (d) => ({ opacity: 0, x: 26 * d, y: 4 }),
  center: { opacity: 1, x: 0, y: 0, transition: tween(dur.page) },
  exit: (d) => ({ opacity: 0, x: -20 * d, y: 0, transition: exitTween(dur.page) }),
};

// Live numeral — NumberFlow digit-roll (odometer): each digit spins to its new
// value, trend=+1 so production counts always roll UPWARD (semantically right for
// output). Respects prefers-reduced-motion natively; on very old Chrome (<125,
// no CSS mod()) it renders a static number — graceful.
function AnimatedNumber({ value }) {
  return <NumberFlow value={Number(value) || 0} trend={+1} />;
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

function StatusPill({ level, label, size = "md" }) {
  const s = STATUS[level];
  const p = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-[12px]";
  // Grayscale "brightness = urgency": Critical gets a bright ring so it pops at a
  // glance (the one state that must grab attention), without adding any colour.
  const emphasis = level === "bad" ? "ring-1 ring-white/35 shadow-[0_0_12px_-2px_rgba(255,255,255,0.25)]" : "";
  return <span className={`inline-flex items-center rounded-[6px] font-semibold ${p} ${s.soft} ${s.text} ${emphasis}`}>{label || s.label}</span>;
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
        fontFamily="'JetBrains Mono', ui-monospace, monospace" fontSize="10.5" fontWeight="600"
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
// Post-login skeleton — geometry-matched shimmer blocks shown between "signed in"
// and "first data fetch landed", killing the 0-value/"No data" flash. The shimmer
// is a transform-only light sweep (compositor-cheap), motion-safe gated.
const Sk = ({ className = "" }) => (
  <div className={`relative overflow-hidden rounded-xl bg-panel border border-hair ${className}`}>
    <div className="absolute inset-0 motion-safe:[animation:shimmer_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
  </div>
);
function ViewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading data" role="status">
      <Sk className="h-9 w-64 mb-7" />
      <Sk className="h-28 mb-4" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[0, 1, 2, 3].map((i) => <Sk key={i} className="h-32" />)}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Sk className="h-72" />
        <Sk className="h-72" />
      </div>
    </div>
  );
}

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

// Numeric-input guards. `min` in HTML is only a hint — a user can type a negative
// or clear a cell and blur. These return null for blank / non-finite / negative
// input so the caller SKIPS the write (leaving the prior value) instead of
// persisting NaN, a negative, or a silent 0 over real planning data.
const cleanInt = (v) => { const s = String(v ?? "").trim(); if (s === "") return null; const n = Math.trunc(Number(s)); return Number.isFinite(n) && n >= 0 ? n : null; };
const cleanNum = (v) => { const s = String(v ?? "").trim(); if (s === "") return null; const n = Number(s); return Number.isFinite(n) && n >= 0 ? n : null; };
// Like cleanInt but rejects ZERO too — for planning quantities (a monthly target,
// a machine-plan-line qty) where 0 is meaningless and must never persist as a real
// row (returns null so the caller skips the write, leaving the prior value).
const cleanPosInt = (v) => { const n = cleanInt(v); return n && n > 0 ? n : null; };

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [data, setData] = useState({ components: [], machines: [], plans: [], entries: [], operations: [], machinePlan: [], settings: {}, users: [], breakdowns: [], componentMachines: [] });
  const [dataReady, setDataReady] = useState(false); // first post-login fetch landed → swap skeleton for real panels
  const [dir, setDir] = useState(1); // view-swap slide direction (sign of tab-index delta)
  const [month, setMonth] = useState(curMonth()); // the VIEWED month — switchable for history review / pre-planning
  const [dataMonth, setDataMonth] = useState(curMonth()); // month the loaded `data` is for — when ≠ month, a switch is in flight
  const [live, setLive] = useState(false); // realtime connection state (supabase mode)
  const loadSeq = useRef(0); // monotonic fetch id — only the latest loadData() may commit (kills the month-switch race)

  // Boot: seed (demo only) then RESTORE an existing Supabase session so a page
  // reload returns straight to the app instead of bouncing to the login screen
  // while a valid auto-refreshing token sits in localStorage.
  useEffect(() => { (async () => {
    if (CONFIG_ERROR) { setBooting(false); return; }
    await seedIfEmpty();
    try {
      const u = db.restoreSession ? await db.restoreSession() : null;
      if (u) await onLogin(u);
    } catch { /* not signed in — fall through to the login screen */ }
    setBooting(false);
  })(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async () => {
    const m = month; // capture — the month this fetch belongs to
    const seq = ++loadSeq.current; // claim this fetch; a newer one bumps the id
    const [components, machines] = await Promise.all([db.listComponents(), db.listMachines()]);
    const [plans, entries, operations, machinePlan, settings, users, breakdowns, componentMachines] = await Promise.all([db.getPlans(m), db.listEntries({ month: m }), db.listOperations ? db.listOperations() : Promise.resolve([]), db.listMachinePlanLines ? db.listMachinePlanLines(m) : Promise.resolve([]), db.getSettings ? db.getSettings() : Promise.resolve({}), db.listUsersLite ? db.listUsersLite() : Promise.resolve([]), db.listBreakdowns ? db.listBreakdowns(m) : Promise.resolve([]), db.listAllowedMachines ? db.listAllowedMachines() : Promise.resolve([])]);
    if (seq !== loadSeq.current) return; // a newer month switch / refetch superseded us → drop this stale (possibly out-of-order) result
    setData({ components, machines, plans, entries, operations, machinePlan, settings, users, breakdowns, componentMachines });
    setDataMonth(m); // mark which month the loaded data is for (drives the switch-skeleton)
  }, [month]);

  // Month switch → refetch (skip while logged out / before the first fetch).
  useEffect(() => { if (user && dataReady) loadData(); }, [loadData]); // eslint-disable-line react-hooks/exhaustive-deps

  const onLogin = async (u) => { setUser(u); setView(u.role === "operator" ? "entry" : "dashboard"); setMonth(curMonth()); await loadData(); setDataReady(true); };
  const logout = async () => { try { await db.signOut(); } catch { /* ignore */ } setUser(null); setView("dashboard"); setDataReady(false); };

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

  // Keep the UI in lock-step with the REAL auth session. If the token is revoked
  // server-side (an admin deactivates this user) or simply expires, GoTrue fires
  // SIGNED_OUT → drop the user so the app returns to login instead of running on
  // a dead session. (Pairs with the deactivate→session-revoke server fix.)
  useEffect(() => {
    if (!db.onAuthStateChange) return;
    return db.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { setUser(null); setView("dashboard"); setDataReady(false); }
    });
  }, []);

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
  // setView with direction: content slides in from the side the new tab sits on.
  const go = (id) => {
    const ids = navTabs.map((t) => t.id);
    setDir(ids.indexOf(id) >= ids.indexOf(view) ? 1 : -1);
    setView(id);
  };
  return (
    <AnimatePresence mode="wait">
      {!user ? (
        <m.div key="login" exit={{ opacity: 0, filter: "blur(8px)" }} transition={exitTween(dur.hero)}>
          <LoginScreen onLogin={onLogin} />
        </m.div>
      ) : (
        <m.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tween(dur.hero)} className="min-h-[100dvh] text-ink relative">
          {/* Tubelight nav (replaces the sidebar — user's pick): floating pill,
              top-center on desktop, bottom thumb-bar on phones. */}
          <NavBar items={navTabs} activeTab={activeTabName} onItemClick={(t) => go(t.id)} />
          {/* Slim fixed header: wordmark left (layoutId flight target from the
              login lockup) + live status, user, logout right. */}
          <header className="fixed top-0 inset-x-0 z-40 h-16 px-4 sm:px-6 flex items-center justify-between pointer-events-none bg-base/80 backdrop-blur-md border-b border-hair/60">
            <div className="pointer-events-auto flex items-center gap-4 min-w-0">
              <Wordmark />
              {/* Month switcher — review past months / pre-plan future ones. Every
                  screen (dashboard, loading, plans, entries) follows this month. */}
              {user.role !== "operator" && (
                <div className={`flex items-center gap-0.5 rounded-lg border px-1 ${month !== curMonth() ? "border-hair-strong bg-white/[0.06]" : "border-hair bg-white/[0.03]"}`}>
                  <button onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month" className="min-h-[40px] min-w-[34px] grid place-items-center rounded text-ink-dim hover:text-ink transition">‹</button>
                  <button onClick={() => setMonth(curMonth())} title={month !== curMonth() ? "Viewing another month — click to return to the current month" : "Current month"} className="font-mono text-[11px] font-semibold tracking-wide text-ink-soft hover:text-ink transition px-1 whitespace-nowrap">
                    {prettyMonth(month)}{month !== curMonth() && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-warn align-middle" aria-label="Not the current month" />}
                  </button>
                  <button onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month" className="min-h-[40px] min-w-[34px] grid place-items-center rounded text-ink-dim hover:text-ink transition">›</button>
                </div>
              )}
            </div>
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
          <div className="pt-20 pb-28 lg:pb-0">
            <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
              {/* show a skeleton while a MONTH SWITCH is in flight (data screens only)
                  so the old month's numbers don't linger under the new header */}
              {(() => {
                const monthSwitching = dataReady && month !== dataMonth && view !== "team";
                const showSkeleton = !dataReady || monthSwitching;
                return (
                  <AnimatePresence mode="wait" custom={dir}>
                    <m.div key={showSkeleton ? "skeleton" : view} custom={dir} variants={viewV} initial="enter" animate="center" exit="exit">
                      {showSkeleton ? <ViewSkeleton /> : (
                        <>
                          {view === "dashboard" && <Dashboard data={data} live={live} setView={go} month={month} />}
                          {view === "entry" && <ShiftEntry data={data} user={user} reload={loadData} month={month} />}
                          {view === "plan" && <PlanSetup data={data} reload={loadData} month={month} setMonth={setMonth} />}
                          {view === "loading" && <MachineLoading data={data} reload={loadData} month={month} />}
                          {view === "team" && <TeamAdmin user={user} />}
                        </>
                      )}
                    </m.div>
                  </AnimatePresence>
                );
              })()}
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
      whileTap={disabled ? undefined : { scale: 0.95 }} transition={spring.tap}
      className={`h-16 rounded-xl grid place-items-center text-2xl font-semibold transition-[filter,transform] duration-200 disabled:opacity-50 disabled:pointer-events-none ${
        variant === "go" ? "bg-gradient-to-b from-brand-300 to-brand-500 text-zinc-900 border-b-2 border-brand-700/70 ring-1 ring-inset ring-white/20 shadow-[0_4px_14px_-3px_rgba(0,0,0,0.55)] hover:brightness-110 active:brightness-95"
        : variant === "back" ? "bg-gradient-to-b from-inset to-[#1c1c21] border border-b-2 border-black/40 ring-1 ring-inset ring-white/[0.06] text-ink-soft hover:text-ink hover:brightness-115"
        : "bg-gradient-to-b from-inset to-[#1c1c21] border border-b-2 border-black/40 ring-1 ring-inset ring-white/[0.06] text-ink font-mono hover:brightness-115 active:brightness-95"}`}>{children}</m.button>
  );

  const modes = [["operator", "Operator"], ["manager", "Manager"]];

  return (
    <ScrollExpandMedia
      title="PRANA VENTURE"
      date="Production Console"
      scene={<HeroScene />}
    >
      {/* Monochrome drift-smoke behind the sign-in card — two soft radial blobs
          that slowly drift via TRANSFORM only (compositor-cheap, no SVG filter, no
          external CDN). motion-safe → static under reduced-motion. */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -inset-[20%] will-change-transform motion-safe:[animation:smoke-a_22s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(40% 40% at 35% 45%, rgba(255,255,255,0.05), transparent 70%)" }} />
        <div className="absolute -inset-[20%] will-change-transform motion-safe:[animation:smoke-b_28s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(45% 45% at 65% 55%, rgba(255,255,255,0.04), transparent 72%)" }} />
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
              animate={{ x: mode === "operator" ? 0 : "100%" }} transition={spring.nav} />
            {modes.map(([id, label]) => (
              <button key={id} onClick={() => { setMode(id); setErr(""); }} aria-pressed={mode === id} className={`relative z-10 min-h-[44px] py-3 rounded-lg text-sm font-semibold transition-colors ${mode === id ? "text-zinc-900" : "text-ink-soft hover:text-ink"}`}>{label}</button>
            ))}
          </div>

          {/* error ABOVE the forms — at the card's bottom it fell below the fold
              on short viewports, so a wrong PIN looked like a silent clear */}
          <AnimatePresence>
            {err && <m.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: dur.pop, ease: ease.out }}><div role="alert" className={`${errCls} mb-4`}><AlertTriangle size={15} className="shrink-0" />{err}</div></m.div>}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {mode === "operator" ? (
              <m.div key="op" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8, transition: exitTween(dur.pop) }} transition={tween(dur.pop)}>
                <div className={labelCls}>PIN</div>
                <div role="status" aria-live="polite" aria-label={pin.length ? `${pin.length} digit${pin.length === 1 ? "" : "s"} entered` : "PIN empty"} className="h-14 mb-4 rounded-xl bg-inset border border-hair flex items-center justify-center gap-3">
                  {pin.length === 0 ? <span className="font-mono text-ink-dim text-[11px] uppercase tracking-[0.28em]">Enter PIN</span> :
                    pin.split("").map((_, i) => <m.span key={i} initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.pop} className="w-3 h-3 rounded-full bg-brand-400" />)}
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <Key key={n} onClick={() => press(String(n))}>{n}</Key>)}
                  <Key onClick={back} variant="back" label="Delete last digit"><Delete size={22} /></Key>
                  <Key onClick={() => press("0")}>0</Key>
                  <Key onClick={pinLogin} variant="go" label="Enter PIN" disabled={pending || pin.length === 0}><ArrowRight size={24} /></Key>
                </div>
              </m.div>
            ) : (
              <m.div key="mgr" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8, transition: exitTween(dur.pop) }} transition={tween(dur.pop)}>
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
    { id: "loading", label: "Loading", icon: Gauge, roles: ["supervisor", "admin"] },
    { id: "team", label: "Team", icon: Users, roles: ["admin"] },
  ].filter((t) => t.roles.includes(user.role)); // kept in sync with the live navTabs (App) so a reversal can't drop tabs
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
              {a && <m.span layoutId="navrail" className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-brand-500" transition={spring.nav} />}
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
function Dashboard({ data, live, month = curMonth() }) {
  const { components, plans, entries } = data;
  const planFor = (cid) => plans.find((p) => p.component_id === cid);
  // Month modes: current = live pace vs days elapsed · past = closed-month
  // review (full month elapsed) · future = planning preview (nothing elapsed).
  const isCurrent = month === curMonth();
  const isPast = month < curMonth();

  const totalMonthly = plans.reduce((s, p) => s + p.target_qty, 0);
  // guard working_days===0 (a degenerate plan row would make target/0 = Infinity → NaN everywhere)
  const dailyTargetTotal = plans.reduce((s, p) => s + (p.working_days ? p.target_qty / p.working_days : 0), 0);
  const actualMonthly = entries.reduce((s, e) => s + e.quantity, 0);
  const noPlan = totalMonthly === 0; // this month was never planned — show a neutral state, not a false "On Track"
  const today = todayStr();
  const todayEntries = entries.filter((e) => e.production_date === today);
  const actualToday = todayEntries.reduce((s, e) => s + e.quantity, 0);
  const scrapMonthly = entries.reduce((s, e) => s + (e.scrap_qty || 0), 0);
  const monthlyPct = totalMonthly ? Math.round((actualMonthly / totalMonthly) * 100) : 0;
  const dailyPct = dailyTargetTotal ? Math.round((actualToday / dailyTargetTotal) * 100) : 0;

  // pace vs WORKING days elapsed (exclude Sundays) — calendar days over-count the target.
  const workingDaysElapsed = isPast ? workingDaysIn(month) : isCurrent ? workingDaysIn(month, new Date().getDate()) : 0;
  const expectedSoFar = Math.min(dailyTargetTotal * workingDaysElapsed, totalMonthly);
  const pace = expectedSoFar ? actualMonthly / expectedSoFar : 1;
  const lvl = levelForPace(pace);
  const paceText = noPlan ? "No plan set for this month"
    : !isCurrent && !isPast ? "Future month — plan preview"
    : isPast ? (lvl === "ok" ? "Month closed at or above plan" : lvl === "warn" ? "Month closed slightly under plan" : "Month closed under plan")
    : lvl === "ok" ? "On track to hit the monthly plan" : lvl === "warn" ? "Slightly behind the expected pace" : "Behind the expected pace — needs attention";
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
  const totalWorkingDays = workingDaysIn(month);
  const workingDaysLeft = Math.max(0, totalWorkingDays - workingDaysElapsed);
  const monthProgress = totalWorkingDays ? Math.round((workingDaysElapsed / totalWorkingDays) * 100) : 0;
  const avgPerDay = workingDaysElapsed ? Math.round(actualMonthly / workingDaysElapsed) : 0;
  const scrapRate = actualMonthly + scrapMonthly > 0 ? (scrapMonthly / (actualMonthly + scrapMonthly)) * 100 : 0;

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <PageHead title="Production Overview" sub={`${prettyMonth(month)}${isPast ? " · closed month" : !isCurrent ? " · future plan" : ""}`} icon={LayoutDashboard} />
        <span className="text-ink-soft text-[13px]">{isCurrent ? new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }) : <span className="font-mono text-[11px] uppercase tracking-wider text-warn-ink">viewing {prettyMonth(month)} — use ‹ › in the header to navigate</span>}</span>
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
            {noPlan ? (
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-dim border border-hair rounded-lg px-2.5 py-1 inline-block">No plan</div>
            ) : (
              <div className="flex items-center gap-2 sm:justify-end">
                <StatusPill level={lvl} size="lg" />
                <VarianceChip delta={paceDelta} pct={pacePct} level={lvl} />
              </div>
            )}
            <div className="text-ink-soft text-sm mt-2 max-w-xs">{noPlan ? paceText : `${monthlyPct}% of plan · ${paceText}`}</div>
          </div>
        </div>
        <div className="relative h-1.5 bg-inset">
          <m.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.85, ease: ease.out }} className="h-full origin-left" style={{ width: `${Math.min(monthlyPct, 100)}%`, background: noPlan ? "#3F3F46" : STATUS[lvl].hex }} />
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
                <Tooltip content={<CompTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <ReferenceLine x={0} stroke={HEX.brand} strokeOpacity={0.55} strokeDasharray="3 3" />
                <Bar dataKey="dev" barSize={16} shape={<DevBar />} isAnimationActive={!REDUCED} animationDuration={700} animationEasing="ease-out">
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
                  {/* split the line + fill at the daily-target line: brighter (on-pace)
                      above, dimmer (behind) below — monochrome, brightness = urgency */}
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
                <Area type="stepAfter" dataKey="actual" name="Output" stroke="url(#splitStroke)" strokeWidth={2.25} fill="url(#splitFill)" style={{ filter: "url(#trendGlow)" }} dot={false} isAnimationActive={!REDUCED} animationDuration={700} animationEasing="ease-out" activeDot={{ r: 4, fill: HEX.brand, stroke: "#0A0A0A", strokeWidth: 2 }} />
                {/* clean overlay carries only the live "now" pulse dot (no glow on it) */}
                <Area type="stepAfter" dataKey="actual" stroke="none" fill="none" legendType="none" tooltipType="none" isAnimationActive={false} activeDot={false} dot={<PulseDot dataLen={trend.length} />} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {isCurrent && (
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
          {/* accountability — who made what, where, TODAY (the question the old
              paper flow answered via the shift supervisor) */}
          {todayEntries.length > 0 && (() => {
            const sumBy = (keyFn, nameFn) => {
              const acc = {};
              todayEntries.forEach((e) => { const k = keyFn(e); if (k) acc[k] = (acc[k] || 0) + (e.quantity || 0); });
              return Object.entries(acc).map(([k, q]) => ({ name: nameFn(k), q })).sort((a, b) => b.q - a.q).slice(0, 5);
            };
            const byMachine = sumBy((e) => e.machine_id, (id) => (data.machines || []).find((m) => m.id === id)?.code || "—");
            const byOperator = sumBy((e) => e.operator_id, (id) => (data.users || []).find((u) => u.id === id)?.name || "—");
            const MiniList = ({ label, rows }) => (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim mb-1.5">{label}</div>
                <ul className="space-y-1">
                  {rows.map((r) => (
                    <li key={r.name} className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="text-ink-soft truncate">{r.name}</span>
                      <span className="font-mono font-bold tnum text-ink shrink-0">{r.q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
            return (
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-hair">
                <MiniList label="Today by machine" rows={byMachine} />
                <MiniList label="Today by operator" rows={byOperator} />
              </div>
            );
          })()}
        </Panel>
        )}

        <Panel title="Component Performance" tag="04" className={isCurrent ? "lg:col-span-7" : "lg:col-span-12"}>
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
                    <span className="w-[9rem] shrink-0 min-w-0">
                      <span className="block font-semibold text-ink text-[13px] truncate">{c.name}</span>
                      {/* the prorated "expected" needs visible context — title attrs are dead on touch */}
                      <span className="block font-mono text-[10px] text-ink-dim tnum">exp {c.expected.toLocaleString()} · tgt {c.target.toLocaleString()}</span>
                    </span>
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
        const { machines = [], operations = [], machinePlan = [], components = [], settings = {}, entries: ents = [] } = data;
        const activeM = machines.filter((m) => m.active !== false);
        if (!activeM.length) return null;
        const targetHr = Number(settings.target_hr) || 2200;
        const opsByComp = {}; for (const o of operations) (opsByComp[o.component_id] ||= []).push(o);
        const outFor = (mid) => ents.filter((e) => e.machine_id === mid).reduce((s, e) => s + (e.quantity || 0), 0);
        const fleet = activeM.map((m) => {
          const d = machineLoadDays(m.id, machinePlan, operations);
          const cap = (m.working_days || 24) * ((m.shifts || 3) / 3);
          return { m, d, cap, pct: cap ? Math.round((d / cap) * 100) : 0, out: outFor(m.id), planned: machinePlan.some((l) => l.machine_id === m.id) };
        }).sort((a, b) => b.pct - a.pct || b.out - a.out);
        const planned = fleet.filter((f) => f.planned);
        const overbooked = fleet.filter((f) => f.pct > 100).length;
        const avgPct = planned.length ? Math.round(planned.reduce((a, x) => a + x.pct, 0) / planned.length) : 0;
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
          <Panel title="Machine Fleet" tag="05" right={<span className="font-mono text-[11px] text-ink-dim">load + output, all machines</span>} className="mt-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Card label="Machines planned" value={`${planned.length} / ${activeM.length}`} />
              <Card label="Avg load · planned m/cs" value={`${avgPct}%`} sub={`fleet-wide ${activeM.length ? Math.round(fleet.reduce((a, x) => a + x.pct, 0) / activeM.length) : 0}%`} tone={avgPct > 100 ? "bad" : "ok"} />
              <Card label="Overbooked" value={overbooked} tone={overbooked > 0 ? "bad" : "ok"} />
              {/* ₹0 with no rates configured reads as "we earn nothing" — say the truth instead */}
              {hrs > 0 && amt === 0
                ? <Card label="Hour-rate" value="—" sub="set part rates in Loading → Costing" />
                : <Card label="Hour-rate" value={inr(hr)} sub={`vs ${inr(targetHr)} target`} tone={hr >= targetHr ? "ok" : hr > 0 ? "bad" : undefined} />}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {fleet.map((f) => {
                const bar = f.pct > 100 ? "bg-bad" : f.pct >= 85 ? "bg-warn" : f.planned ? "bg-ok" : "bg-over";
                return (
                  <div key={f.m.id} className={`rounded-lg bg-inset/40 border p-2.5 ${f.pct > 100 ? "border-beam-alert border-hair-strong" : "border-hair"}`}>
                    <div className="font-semibold text-[12px] text-ink truncate">{f.m.name}</div>
                    <div className="flex items-baseline justify-between mt-1">
                      {/* "idle" really meant "no plan lines" — and a no-plan machine WITH
                          output is a planning gap worth surfacing, not hiding */}
                      <span className={`font-mono text-[11px] ${f.pct > 100 ? "text-bad-ink" : !f.planned && f.out > 0 ? "text-warn-ink" : "text-ink-dim"}`}>{f.planned ? `${f.pct}%` : f.out > 0 ? "no plan*" : "no plan"}</span>
                      <span className="font-mono text-[11px] text-ink-soft">{f.out} <span className="text-ink-dim">pcs MTD</span></span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-over overflow-hidden"><div className={`h-full origin-left transition-transform duration-700 ease-out ${bar}`} style={{ transform: `scaleX(${Math.min(f.pct, 100) / 100})` }} /></div>
                  </div>
                );
              })}
            </div>
            {(() => {
              const unplanned = fleet.filter((f) => !f.planned && f.out > 0).reduce((s, f) => s + f.out, 0);
              return unplanned > 0 ? <div className={`${warnCls} mt-3`}><AlertTriangle size={15} className="shrink-0" /><span><b className="tnum">{unplanned} pcs</b> this month were logged on machines marked "no plan*" — assign those parts in Loading so plan-vs-actual reconciles.</span></div> : null;
            })()}
            {!machinePlan.length && <div className={`${hintCls} mt-3`}><Check size={14} className="shrink-0 mt-0.5 text-ok-ink" /><span>Assign parts to machines in the Loading tab to see load %, capacity, and hour-rate fill in here. Output (pcs) shows live as operators log production.</span></div>}
          </Panel>
        );
      })()}
    </>
  );
}

/* ------------------------------ Shift Entry ------------------------------- */
function ShiftEntry({ data, user, reload, month = curMonth() }) {
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
  const [pending, setPending] = useState([]); // optimistic rows awaiting server ack
  const [delEntry, setDelEntry] = useState(null); // entry pending delete-confirm
  const [delBusy, setDelBusy] = useState(false);
  const [showAll, setShowAll] = useState(false); // expand past the 9 most recent
  const [editEntry, setEditEntry] = useState(null); // entry being corrected (manager)
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState("");

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
  const userName = (id) => (data.users || []).find((u) => u.id === id)?.name || "—";

  // Correct a saved entry (manager): qty / scrap / notes — the fields typos hit.
  const saveEdit = async () => {
    if (editBusy || !editEntry) return;
    setEditBusy(true); setEditErr("");
    try {
      await db.updateEntry(editEntry.id, { quantity: Number(editEntry.quantity) || 0, scrap_qty: Number(editEntry.scrap_qty) || 0, notes: String(editEntry.notes || "").trim() });
      await reload();
      setEditEntry(null);
    } catch (e) { setEditErr(e?.message || "Could not save the correction."); }
    finally { setEditBusy(false); }
  };

  const dup = entries.find((e) => e.production_date === date && e.shift === shift && e.component_id === componentId && e.operator_id === user.id);

  const closeConfirm = () => { setConfirm(false); setError(""); };
  // Require real output: a produced qty > 0, OR a scrap count > 0 (a pure-scrap
  // shift is legitimate). Block the all-zero row that created the "5048A × 0" entry.
  const open = () => {
    if (!componentId) return;
    if (Number(qty) > 0 || Number(scrap) > 0) { setError(""); setConfirm(true); }
    else setError("Enter a produced quantity (or a scrap count) before saving.");
  };
  // OPTIMISTIC SAVE — the operator's acknowledgment must land ≤100ms (NN/g direct-
  // manipulation threshold), so the row, toast and haptic fire IMMEDIATELY and the
  // server reconciles in the background. On rejection the optimistic row is pulled,
  // the form values are RESTORED, and the dialog reopens with the error.
  const doSave = () => {
    if (saving) return; // guard against a double-tap firing addEntry twice
    if (!(Number(qty) > 0 || Number(scrap) > 0)) return; // belt-and-braces: never persist a fully-empty row
    const entry = { production_date: date, shift, component_id: componentId, machine_id: machineId || null, operator_id: user.id, quantity: Number(qty), scrap_qty: Number(scrap), notes: notes.trim() };
    const tempId = `tmp-${Date.now()}`;
    setSaving(true);
    setPending((p) => [{ ...entry, id: tempId, created_at: Date.now() }, ...p]);
    setError(""); setConfirm(false); setQty(0); setScrap(0); setNotes("");
    setToast(`Recorded ${compName(entry.component_id)} · Shift ${entry.shift}`);
    setTimeout(() => setToast(""), 2200);
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch { /* blocked — fine */ } }
    (async () => {
      try {
        await db.addEntry(entry);
        await reload();
        setPending((p) => p.filter((x) => x.id !== tempId));
      } catch (e) {
        // rollback: pull the optimistic row, put the values back, surface the error
        setPending((p) => p.filter((x) => x.id !== tempId));
        setToast("");
        setQty(entry.quantity); setScrap(entry.scrap_qty); setNotes(entry.notes);
        setError(e?.message || "Could not save this entry. Please try again.");
        setConfirm(true);
      } finally {
        setSaving(false);
      }
    })();
  };

  // Destructive: only runs after the focus-trapped ConfirmDialog is confirmed.
  const confirmDeleteEntry = async () => {
    if (delBusy || !delEntry) return;
    setDelBusy(true); setError("");
    try { await db.removeEntry(delEntry.id); await reload(); setDelEntry(null); }
    catch (e) { setError(e?.message || "Couldn't delete that entry — please retry."); }
    finally { setDelBusy(false); }
  };

  let allMine = [...entries].sort((a, b) => b.created_at - a.created_at);
  if (!isManager) allMine = allMine.filter((e) => e.operator_id === user.id);
  allMine = [...pending, ...allMine]; // optimistic rows lead until acked
  const recent = showAll ? allMine : allMine.slice(0, 9);

  const Stepper = ({ value, set }) => (
    <div className="flex items-center gap-3">
      <button onClick={() => set(Math.max(0, value - 1))} aria-label="Decrease" className="w-16 h-16 rounded-xl grid place-items-center active:scale-95 transition ease-spring-out border border-hair bg-inset text-ink hover:border-brand-500/55 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"><Minus size={24} /></button>
      <input type="number" min="0" value={value} onChange={(e) => set(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-24 text-center font-mono text-4xl font-bold tnum bg-inset border border-hair rounded-xl py-2 text-ink focus:border-brand-500 outline-none transition" />
      <button onClick={() => set(value + 1)} aria-label="Increase" className="w-16 h-16 rounded-xl grid place-items-center active:scale-95 transition ease-spring-out border border-hair bg-inset text-ink hover:border-brand-500/55 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"><Plus size={24} /></button>
    </div>
  );

  const chip = (active) => `ease-spring-out ${active ? "border-brand-500 bg-brand-500/[0.10] text-brand-200 ring-1 ring-brand-500/30" : "border-hair bg-inset text-ink-soft hover:border-brand-500/40"}`;

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
          {/* month-boundary guard: a backdated/forward-dated entry SAVES fine but
              lands in another month's view — say so instead of silently "vanishing" */}
          {date && date.slice(0, 7) !== curMonth() && <div className={`${warnCls} mb-3`}><Clock size={16} className="shrink-0" /><span>This entry is dated <b>{prettyMonth(date.slice(0, 7))}</b> — it will be saved there and won't show on the current month's dashboard. Use the ‹ › month switcher (managers) to review it.</span></div>}

          <LiquidButton onClick={open} disabled={!componentId} size="xl" className="group w-full text-base disabled:opacity-50 disabled:pointer-events-none">Record Output <ArrowRight size={20} className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1" /></LiquidButton>
        </Panel>

        <Panel title={isManager ? "Recent Entries (all operators)" : "My Recent Entries"} tag="LOG" className="lg:col-span-5">
          {recent.length === 0 && <Empty msg="No entries yet — log your first one." />}
          <div className="space-y-2">
            {recent.map((e) => {
              const isPending = String(e.id).startsWith("tmp-");
              return (
                <div key={e.id} className={`flex items-center justify-between px-3.5 py-3 bg-inset border rounded-xl ${isPending ? "border-hair-strong" : "border-hair"}`}>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-ink truncate">{compName(e.component_id)}</div>
                    <div className="font-mono text-[11px] text-ink-dim tnum mt-0.5">{e.production_date} · Shift {e.shift} · {machName(e.machine_id)}{isManager ? ` · ${userName(e.operator_id)}` : ""}{e.scrap_qty ? ` · ${e.scrap_qty} scrap` : ""}{e.notes ? " · note" : ""}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="text-right tabular-nums mr-1">
                      <div className="font-mono font-bold text-[19px] tnum text-ink leading-none">{e.quantity}</div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-ink-dim mt-1">units</div>
                    </div>
                    {isPending && <span className="relative flex h-1.5 w-1.5 mr-1" title="Syncing…" aria-label="Syncing"><span className="absolute inline-flex h-full w-full rounded-full bg-ink-soft motion-safe:animate-ping opacity-60" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ink-soft" /></span>}
                    {isManager && !isPending && <button onClick={() => { setEditErr(""); setEditEntry({ ...e }); }} aria-label="Edit entry" className="p-2 min-h-[44px] min-w-[44px] grid place-items-center rounded-lg text-ink-dim hover:bg-white/[0.06] hover:text-ink transition"><PencilSimple size={15} /></button>}
                    {isManager && !isPending && <button onClick={() => setDelEntry(e)} aria-label="Delete entry" className="p-2 min-h-[44px] min-w-[44px] grid place-items-center rounded-lg text-ink-dim hover:bg-white/[0.06] hover:text-bad-ink transition"><Trash2 size={15} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
          {allMine.length > 9 && (
            <button onClick={() => setShowAll((v) => !v)} className="mt-3 w-full min-h-[44px] rounded-xl border border-hair bg-inset text-ink-soft hover:text-ink hover:border-brand-500/40 text-[13px] font-semibold transition">
              {showAll ? "Show recent only" : `View all ${allMine.length} entries · ${prettyMonth(month)}`}
            </button>
          )}
          {!isManager && <div className={`${hintCls} mt-3`}><ShieldCheck size={14} className="shrink-0 mt-0.5 text-ink-dim" /><span>Only a supervisor can edit or delete entries.</span></div>}
        </Panel>
      </div>

      <AnimatePresence>
        {confirm && (
          <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-base/85 p-4" onClick={closeConfirm}>
            <m.div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="confirm-title" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10, transition: exitTween(dur.modal) }} transition={spring.modal} className="bg-over border border-hair-strong relative overflow-hidden rounded-[10px] p-6 w-full max-w-sm shadow-pop" onClick={(e) => e.stopPropagation()}>
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
                <m.button onClick={closeConfirm} disabled={saving} whileTap={{ scale: 0.97 }} transition={spring.tap} className={`${btnSecondary} flex-1 !py-3.5`}>Cancel</m.button>
                <m.button onClick={doSave} disabled={saving} whileTap={{ scale: 0.97 }} transition={spring.tap} className="flex-1 py-3.5 rounded-lg bg-gradient-to-b from-brand-300 to-brand-500 text-zinc-900 border-b-2 border-brand-700/70 ring-1 ring-inset ring-white/20 hover:brightness-110 active:brightness-95 font-semibold transition flex items-center justify-center gap-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22)] disabled:opacity-60 disabled:cursor-not-allowed">{saving ? "Saving…" : <><Check size={18} /> Confirm</>}</m.button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <m.div role="status" aria-live="polite" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={spring.pop} className="fixed bottom-5 right-5 z-50 bg-coal border border-hair rounded-[8px] shadow-pop px-4 py-3 flex items-center gap-3">
            <span className="w-5 h-5 rounded-full bg-ok grid place-items-center shrink-0">
              {/* drawn-on check — the "it landed" moment */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <m.path d="M4.5 12.5l5 5L19.5 7" stroke="#0A0A0A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"
                  initial={REDUCED ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.32, ease: ease.out }} />
              </svg>
            </span>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim">Logged</div>
              <div className="text-ink font-semibold text-sm">{toast}</div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Correct-entry dialog (manager) — fixes the delete-and-retype dance.
          The audit trigger logs the before-image server-side. */}
      <AnimatePresence>
        {editEntry && (
          <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-base/85 p-4" onClick={() => !editBusy && setEditEntry(null)}>
            <m.div role="dialog" aria-modal="true" aria-labelledby="edit-entry-title" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10, transition: exitTween(dur.modal) }} transition={spring.modal} className="bg-over border border-hair-strong relative overflow-hidden rounded-[10px] p-6 w-full max-w-sm shadow-pop" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-1"><h3 id="edit-entry-title" className="font-display font-bold text-lg">Correct entry</h3><button onClick={() => !editBusy && setEditEntry(null)} aria-label="Close" className="p-2 min-h-[44px] min-w-[44px] grid place-items-center rounded-lg text-ink-dim hover:bg-white/[0.06]"><X size={18} /></button></div>
              <div className="font-mono text-[11px] text-ink-dim tnum mb-4">{compName(editEntry.component_id)} · {editEntry.production_date} · Shift {editEntry.shift} · {machName(editEntry.machine_id)} · {userName(editEntry.operator_id)}</div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className={labelCls}>Quantity</label><input type="number" min="0" value={editEntry.quantity} onChange={(e) => setEditEntry((x) => ({ ...x, quantity: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Scrap</label><input type="number" min="0" value={editEntry.scrap_qty || 0} onChange={(e) => setEditEntry((x) => ({ ...x, scrap_qty: e.target.value }))} className={inputCls} /></div>
              </div>
              <label className={labelCls}>Notes</label>
              <textarea rows={2} value={editEntry.notes || ""} onChange={(e) => setEditEntry((x) => ({ ...x, notes: e.target.value }))} className={`${inputCls} resize-none mb-4`} />
              {editErr && <div className={`${errCls} mb-4`}><AlertTriangle size={16} className="shrink-0" /><span>{editErr}</span></div>}
              <div className="flex gap-3">
                <m.button onClick={() => setEditEntry(null)} disabled={editBusy} whileTap={{ scale: 0.97 }} transition={spring.tap} className={`${btnSecondary} flex-1 !py-3.5`}>Cancel</m.button>
                <m.button onClick={saveEdit} disabled={editBusy} whileTap={{ scale: 0.97 }} transition={spring.tap} className="flex-1 py-3.5 rounded-lg bg-gradient-to-b from-brand-300 to-brand-500 text-zinc-900 border-b-2 border-brand-700/70 ring-1 ring-inset ring-white/20 hover:brightness-110 active:brightness-95 font-semibold transition flex items-center justify-center gap-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22)] disabled:opacity-60 disabled:cursor-not-allowed">{editBusy ? "Saving…" : <><Check size={18} /> Save correction</>}</m.button>
              </div>
            </m.div>
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
  // Credential recovery — a forgotten manager password was a permanent lockout,
  // and the admin's own (chat-exposed) password had no in-app rotation path.
  const [recover, setRecover] = useState(null); // user pending reset/regen confirm
  const [rBusy, setRBusy] = useState(false);
  const confirmRecover = async () => {
    if (!recover || rBusy) return;
    setRBusy(true); setErr("");
    try {
      if (recover.role === "operator") {
        const r = await db.adminRegeneratePin(recover.id);
        setCreated({ type: "operator", ...r });
      } else {
        const r = await db.adminResetPassword(recover.id);
        setCreated({ type: "manager", role: recover.role, ...r });
      }
      await load(); setRecover(null);
    } catch (e) { setErr(e.message || "Failed to reset credentials"); }
    finally { setRBusy(false); }
  };

  const operators = (users || []).filter((u) => u.role === "operator");
  const managers = (users || []).filter((u) => u.role !== "operator");

  return (
    <>
      <PageHead title="Team" sub="Add operators and managers · PINs and passwords are generated and shown once" />

      <div className="my-6"><AnimatePresence>{created && <CredentialReveal created={created} onClose={() => setCreated(null)} />}</AnimatePresence>
        <AnimatePresence>{err && <m.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: dur.pop, ease: ease.out }}><div role="alert" className={`${errCls} mb-4`}><AlertTriangle size={15} className="shrink-0" />{err}</div></m.div>}</AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Add Operator" tag="01">
            <p className="text-ink-soft text-sm mb-4 -mt-1">Operators log in with a PIN. Just enter the name — a unique 6-digit PIN is generated.</p>
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
                  <span className="ml-auto flex items-center gap-2">
                    {u.active && <button onClick={() => setRecover(u)} title="Generate a new PIN (the old one stops working)" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-inset border border-hair text-ink-soft hover:text-ink hover:border-brand-500/40 transition inline-flex items-center gap-1.5"><ArrowsClockwise size={13} /> New PIN</button>}
                    <button onClick={() => setToggle(u)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-inset border border-hair text-ink-soft hover:text-ink hover:border-brand-500/40 transition">{u.active ? "Deactivate" : "Reactivate"}</button>
                  </span>
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
                  <span className="ml-auto flex items-center gap-2">
                    {u.active && <button onClick={() => setRecover(u)} title={u.id === user.id ? "Rotate your own password (the new one is shown once)" : "Generate a new password (the old one stops working)"} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-inset border border-hair text-ink-soft hover:text-ink hover:border-brand-500/40 transition inline-flex items-center gap-1.5"><ArrowsClockwise size={13} /> Reset password</button>}
                    {u.id !== user.id && <button onClick={() => setToggle(u)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-inset border border-hair text-ink-soft hover:text-ink hover:border-brand-500/40 transition">{u.active ? "Deactivate" : "Reactivate"}</button>}
                  </span>
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

      <ConfirmDialog
        open={!!recover}
        title={recover?.role === "operator" ? "Generate a new PIN?" : "Reset this password?"}
        body={recover ? <>{recover.role === "operator"
          ? <><b className="text-ink">{recover.name}</b> gets a fresh PIN; the old PIN stops working immediately. The new PIN is shown once — hand it over right away.</>
          : <><b className="text-ink">{recover.name}</b> gets a fresh generated password; the old one stops working immediately. The new password is shown once.{recover.id === user.id ? " You'll need it for your own next login." : ""}</>}</> : null}
        confirmLabel={recover?.role === "operator" ? "New PIN" : "Reset password"}
        danger
        busy={rBusy}
        onConfirm={confirmRecover}
        onClose={() => { if (!rBusy) setRecover(null); }}
      />
    </>
  );
}

/* ----------------------------- Costing (Phase 5) -------------------------- */
// The sheet's costing block: per part — Amount (rate×qty), Hour-Rate vs the
// ₹2200 target, Targeted amount, Loss. Rolls up to the machine's overall HR.
function MachineCosting({ machine, lines, operations, components, reload, targetHr = TARGET_HR, machineRate = 1200 }) {
  const opsByComp = {};
  for (const o of operations || []) (opsByComp[o.component_id] ||= []).push(o);
  const compOf = (id) => (components || []).find((c) => c.id === id) || {};
  const [rErr, setRErr] = useState("");
  const setRate = async (id, v) => { const r = cleanNum(v); if (r === null) return; try { setRErr(""); await db.setComponentRate(id, r); await reload(); } catch (e) { setRErr(e?.message || "Rate didn't save — please retry."); } };

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
  const machineCost = machineRate * totHours; // ₹/machine-hour × planned hours (the Excel header's "Machine Hour rate")
  const ratesUnset = totAmount === 0 && totHours > 0;
  const hrTone = (hr) => hr >= targetHr ? "text-ok-ink" : hr >= targetHr * 0.8 ? "text-warn-ink" : "text-bad-ink";

  return (
    <Panel title="Costing" tag="05" right={<span className="font-mono text-[11px] text-ink-dim">target HR {inr(targetHr)}/hr</span>} className="mt-4">
      {ratesUnset ? (
        /* every rate is 0 → "loss ₹9 lakh" would be fiction. Say what's actually wrong. */
        <div className={`${warnCls} mb-4`}><AlertTriangle size={15} className="shrink-0" /><span>Part rates aren't set, so hour-rate and loss can't be computed yet — enter each part's <b>Rate ₹/pc</b> below (or in Plan Setup).</span></div>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 mb-4">
          <span className="text-ink-soft text-sm">Machine hour-rate:</span>
          <span className={`font-mono text-2xl font-bold tnum ${hrTone(machineHr)}`}>{inr(machineHr)}<span className="text-ink-dim text-sm">/hr</span></span>
          <span className="font-mono text-sm text-ink-soft">vs {inr(targetHr)} target</span>
          {totLoss > 0 && <span className="font-mono text-sm text-bad-ink">loss {inr(totLoss)}</span>}
          <span className="font-mono text-sm text-ink-dim" title={`machine cost = ${inr(machineRate)}/hr × ${round1(totHours)} hrs (Settings → Machine hour-rate)`}>machine cost {inr(machineCost)} · margin <span className={totAmount - machineCost < 0 ? "text-bad-ink font-semibold" : ""}>{inr(totAmount - machineCost)}{totAmount - machineCost < 0 ? " · LOSS" : ""}</span></span>
        </div>
      )}
      {rErr && <div role="alert" className={`${errCls} mb-4`}><AlertTriangle size={15} className="shrink-0" />{rErr}</div>}
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
                <td className={`py-2.5 px-2 text-right font-mono tnum ${!r.c.rate ? "text-ink-dim" : r.loss > 0 ? "text-bad-ink" : "text-ink-dim"}`}>{!r.c.rate ? "set rate" : r.loss > 0 ? inr(r.loss) : "—"}</td>
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
              // zero output must read 0 days — setup time alone painted "2.3 days
              // burned producing nothing" on untouched parts
              const actDays = a.qty > 0 ? componentCapacity(ops, a.qty).days : 0;
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
                      <div className="flex-1 h-2 rounded-full bg-over overflow-hidden"><div className={`h-full origin-left transition-transform duration-700 ease-out ${tone.split(" ")[0]}`} style={{ transform: `scaleX(${Math.min(pct, 100) / 100})` }} /></div>
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
function MachineSheet({ machine, lines, operations, components, month = curMonth() }) {
  const opsByComp = {};
  for (const o of operations || []) (opsByComp[o.component_id] ||= []).push(o);
  const sched = scheduleMachine(lines, opsByComp, month);
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
function MachineSchedule({ machine, lines, operations, components, month = curMonth() }) {
  const opsByComp = {};
  for (const o of operations || []) (opsByComp[o.component_id] ||= []).push(o);
  const rows = scheduleMachine(lines, opsByComp, month);
  const { first, last, totalMs } = monthBounds(month);
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
          // `last` is MIDNIGHT of the final day, so a plain `end > last` flags any op
          // finishing DURING the last day. Compare against the exclusive next-month
          // boundary so only ops that truly run into the next month are flagged.
          const monthEndExclusive = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).getTime();
          const overflows = r.end.getTime() >= monthEndExclusive;
          // today marker — without it a mid-month Gantt reads as "all done"
          const todayMs = Date.now() - first.getTime();
          const todayPct = todayMs > 0 && todayMs < totalMs ? (todayMs / totalMs) * 100 : null;
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="w-40 shrink-0 truncate text-[12px]"><span className="font-semibold text-ink">{nameOf(r.component_id)}</span> <span className="font-mono text-ink-dim">op{r.op_no}</span></div>
              <div className="relative flex-1 h-6 rounded bg-inset/60 overflow-hidden">
                <div className="absolute top-0 h-full rounded bg-gradient-to-r from-brand-500/70 to-brand-400/60 border border-brand-400/40 transition-[left,width] duration-500 ease-out" style={{ left: `${Math.min(left, 98)}%`, width: `${Math.min(width, 100 - Math.min(left, 98))}%` }} title={`${fmtDate(r.start)} → ${fmtDate(r.end)} · ${round1(r.days)}d${overflows ? " · spills into next month" : ""}`} />
                {overflows && <div className="absolute top-0 bottom-0 right-0 w-1.5 bg-warn-ink/90" title={`spills into next month — finishes ${fmtDate(r.end)}`} aria-hidden="true" />}
                {todayPct !== null && <div className="absolute top-0 bottom-0 w-px bg-bad/80" style={{ left: `${todayPct}%` }} title={`today · ${todayStr()}`} aria-hidden="true" />}
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

function MachineLoading({ data, reload, month = curMonth() }) {
  const { machines, components, operations, machinePlan, breakdowns, componentMachines } = data;
  const active = machines.filter((m) => m.active !== false);
  const activeComps = components.filter((c) => c.active !== false);
  const [selId, setSelId] = useState(active[0]?.id || "");
  const sel = active.find((m) => m.id === selId) || active[0];
  const [compId, setCompId] = useState(activeComps[0]?.id || "");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [delLine, setDelLine] = useState(null); const [delBusy, setDelBusy] = useState(false);
  const [downBusy, setDownBusy] = useState(false); // mark-down / bring-up in flight

  if (!active.length) return <><PageHead title="Machine Loading" sub="Assign parts to machines and see capacity" /><div className="mt-6"><Empty msg="No machines yet. Seed your machines first." /></div></>;

  // Machines marked DOWN this month → capacity 0 (their load must move elsewhere).
  const downSet = new Set((breakdowns || []).map((b) => b.machine_id));
  // Machine capacity in 3-shift-equivalent days = working_days × shifts/3; a DOWN
  // machine has 0 capacity this month.
  const wd = (m) => (isDown(m && m.id, downSet) ? 0 : round1(((m && m.working_days) || MACHINE_DAYS) * (((m && m.shifts) || 3) / 3)));
  const lines = (machinePlan || []).filter((l) => l.machine_id === sel.id);
  const selDays = machineLoadDays(sel.id, machinePlan, operations);
  const selCap = wd(sel);
  const selPct = selCap ? Math.round((selDays / selCap) * 100) : 0;
  const compName = (id) => components.find((c) => c.id === id)?.name || "?";
  const compOps = (id) => (operations || []).filter((o) => o.component_id === id);
  // Machine eligibility: only parts ALLOWED on the selected machine show in the
  // add-line picker (empty allow-list = all parts) — "if it can't run here, hide it".
  const eligibleComps = activeComps.filter((c) => isAllowedOn(c.id, sel.id, componentMachines));
  const effCompId = eligibleComps.some((c) => c.id === compId) ? compId : (eligibleComps[0]?.id || "");

  const addLine = async () => {
    if (busy || !effCompId || selDown) return; // never add fresh load onto a DOWN (0-capacity) machine
    const q = cleanPosInt(qty); // reject 0 / blank / negative — never persist a zero-qty plan line
    if (!q) { setErr("Enter a quantity greater than 0."); return; }
    setBusy(true); setErr("");
    try { await db.addMachinePlanLine({ month, machine_id: sel.id, component_id: effCompId, qty: q, seq: lines.length }); setQty(""); await reload(); }
    catch (e) { setErr(e.message || "Failed to add"); } finally { setBusy(false); }
  };
  const editQty = async (id, v) => { const q = cleanInt(v); if (q === null) return; try { setErr(""); await db.updateMachinePlanLine(id, { qty: q }); await reload(); } catch (e) { setErr(e?.message || "Quantity didn't save — please retry."); } };
  const confirmDel = async () => { if (delBusy || !delLine) return; setDelBusy(true); try { await db.removeMachinePlanLine(delLine.id); await reload(); setDelLine(null); } catch { /* keep */ } finally { setDelBusy(false); } };
  // Run-order control: the Gantt schedules strictly in seq order, so swapping seq
  // with a neighbour is how you say "run part B first" (was delete-and-retype).
  const moveLine = async (l, dirn) => {
    const idx = lines.findIndex((x) => x.id === l.id);
    const other = lines[idx + dirn];
    if (!other) return;
    try {
      setErr("");
      // index-based renumber (not a raw swap) — survives duplicate seq values
      await db.updateMachinePlanLine(l.id, { seq: idx + dirn });
      try {
        await db.updateMachinePlanLine(other.id, { seq: idx });
      } catch (e2) {
        await db.updateMachinePlanLine(l.id, { seq: idx }).catch(() => {}); // roll the first write back so we never leave two lines with a wrong/duplicate run-order
        throw e2;
      }
      await reload();
    } catch (e) { setErr(e?.message || "Re-ordering failed — please retry."); }
  };

  // --- machine breakdown + flexible re-routing ------------------------------
  const selDown = isDown(sel.id, downSet);
  const toggleDown = async () => {
    setDownBusy(true); setErr("");
    try {
      if (selDown) await db.clearMachineDown(sel.id, month);
      else await db.setMachineDown(sel.id, month);
      await reload();
    } catch (e) { setErr(e?.message || "Couldn't update machine status — please retry."); }
    finally { setDownBusy(false); }
  };
  const seqOn = (plan, machineId) => (plan || []).filter((x) => x.machine_id === machineId).length; // append to a machine's run order
  const reassignCtx = (plan) => ({ machines, machinePlan: plan, operations, componentMachines, downSet, excludeId: sel.id });
  const reassign = async (line, targetId) => {
    setErr(""); setDownBusy(true);
    try { await db.updateMachinePlanLine(line.id, { machine_id: targetId, seq: seqOn(machinePlan, targetId) }); await reload(); }
    catch (e) { setErr(e?.message || "Move failed — please retry."); }
    finally { setDownBusy(false); }
  };
  const moveAll = async () => {
    setErr(""); setDownBusy(true);
    try {
      let plan = machinePlan; // local copy so each move sees the prior one (sequential greedy)
      const stranded = [];
      for (const l of lines) {
        const cands = suggestMachines({ componentId: l.component_id, ops: compOps(l.component_id), qty: l.qty, ...reassignCtx(plan) });
        const best = cands.find((c) => c.fits); // only move where it actually FITS (under the rated ceiling)
        if (!best) { stranded.push(compName(l.component_id)); continue; } // nothing fits — leave it here rather than silently overbook a machine
        await db.updateMachinePlanLine(l.id, { machine_id: best.machine.id, seq: seqOn(plan, best.machine.id) });
        plan = plan.map((x) => (x.id === l.id ? { ...x, machine_id: best.machine.id } : x));
      }
      if (stranded.length) setErr(`Moved what fit. No free machine has room for: ${stranded.join(", ")} — split ${stranded.length === 1 ? "it" : "them"} across machines, or free up capacity first.`);
    } catch (e) { setErr(e?.message || "Move-all failed — please retry."); }
    finally { await reload().catch(() => {}); setDownBusy(false); }
  };
  const splitLine = async (line) => {
    setErr(""); setDownBusy(true);
    try {
      const { alloc, unplaced } = suggestSplit({ componentId: line.component_id, ops: compOps(line.component_id), qty: line.qty, ...reassignCtx(machinePlan) });
      if (!alloc.length) { setErr("No eligible free machine can take any of this part."); return; }
      const [first, ...rest] = alloc; // keep the existing line for the first chunk; spill the rest into new lines.
      // Add the spill lines FIRST (purely additive), and only AFTER they all land do
      // we shrink/reassign the ORIGINAL line (the one destructive step). A failure
      // mid-way then leaves the original line at full qty — total planned qty can
      // never silently drop below the original (no lost-quantity-on-partial-failure).
      for (const a of rest) await db.addMachinePlanLine({ month, machine_id: a.machine.id, component_id: line.component_id, qty: a.qty, seq: seqOn(machinePlan, a.machine.id) });
      await db.updateMachinePlanLine(line.id, { machine_id: first.machine.id, qty: first.qty, seq: seqOn(machinePlan, first.machine.id) });
      if (unplaced > 0) setErr(`Split placed what fit — ${unplaced} pcs couldn't fit on any free machine (over capacity).`);
    } catch (e) { setErr(e?.message || "Split failed — some lines may not have moved; check the plan below and retry."); }
    finally { await reload().catch(() => {}); setDownBusy(false); } // always refresh so the UI reflects the TRUE db state, even after a partial failure
  };
  // Move a placed line that's no longer allowed on this machine to its best eligible
  // (and fitting) free machine — the one-click fix for an eligibility violation.
  const moveToEligible = async (l) => {
    const cands = suggestMachines({ componentId: l.component_id, ops: compOps(l.component_id), qty: l.qty, ...reassignCtx(machinePlan) });
    const best = cands.find((c) => c.fits) || cands[0];
    if (!best) { setErr(`${compName(l.component_id)} has no other eligible machine — widen its allowed machines first.`); return; }
    await reassign(l, best.machine.id);
  };

  // --- machine eligibility (which machines a part may run on) ---------------
  const toggleEligibility = async (componentId, machineId) => {
    const cur = new Set(allowedMachines(componentId, componentMachines, active).map((mm) => mm.id));
    const turningOn = !cur.has(machineId);
    if (turningOn) cur.add(machineId); else cur.delete(machineId);
    let next = active.filter((mm) => cur.has(mm.id)).map((mm) => mm.id);
    if (!next.length) {
      // A part must be runnable somewhere. The empty set is the "all-allowed"
      // sentinel, so turning OFF the last lit machine must NOT silently flip the
      // part to "runs anywhere" (the exact opposite of intent) — block it instead.
      setErr(`${compName(componentId)} must stay allowed on at least one machine. To let it run anywhere, light up all machines instead.`);
      return;
    }
    // Collapse to the all-allowed sentinel (0 rows) ONLY when this toggle turned a
    // machine ON and that completed the full set — never on a turn-OFF path.
    if (turningOn && next.length === active.length) next = [];
    setErr("");
    try { await db.setAllowedMachines(componentId, next); await reload(); }
    catch (e) { setErr(e?.message || "Couldn't update compatibility — please retry."); }
  };

  return (
    <>
      <PageHead title="Machine Loading" sub={`${prettyMonth(month)} · planned days vs each machine's working month`} />

      {/* overview: every machine's load at a glance */}
      <Panel title="All Machines — load this month" tag="01" className="mt-6 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {active.map((m) => {
            const down = isDown(m.id, downSet);
            const d = machineLoadDays(m.id, machinePlan, operations);
            const cap = wd(m);
            const pct = cap > 0 ? Math.round((d / cap) * 100) : 0;
            const tone = loadTone(pct);
            return (
              <button key={m.id} onClick={() => setSelId(m.id)} className={`text-left rounded-lg border ${m.id === sel.id ? "border-brand-500 bg-brand-500/[0.06]" : down ? "border-bad/40 bg-bad-soft/20" : tone.ring + " bg-inset/50 hover:border-brand-500/40"} p-3 transition`}>
                <div className="flex items-center gap-1.5"><span className="font-semibold text-[13px] text-ink truncate">{m.name}</span>{down && <span className="font-mono text-[9px] uppercase tracking-wider text-bad-ink border border-bad/40 rounded px-1 py-0.5 shrink-0">down</span>}</div>
                {down
                  ? <div className="mt-1.5 font-mono text-[11px] text-bad-ink">{round1(d)}d stranded · tap to move</div>
                  : <>
                      <div className="mt-1.5 flex items-baseline gap-1"><span className={`font-mono font-bold tnum ${tone.text}`}>{round1(d)}</span><span className="font-mono text-[11px] text-ink-dim">/ {cap}d</span></div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-over overflow-hidden"><div className={`h-full origin-left transition-transform duration-700 ease-out ${tone.bar}`} style={{ transform: `scaleX(${Math.min(pct, 100) / 100})` }} /></div>
                      {pct > 100 && <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-bad-ink">over by {round1(d - cap)}d</div>}
                    </>}
              </button>
            );
          })}
        </div>
      </Panel>

      {/* selected machine's plan */}
      <Panel title={`Plan — ${sel.name}`} tag="02" right={
        <div className="flex items-center gap-2">
          <button onClick={toggleDown} disabled={downBusy} className={`text-xs font-semibold px-3 py-2 rounded-lg border transition disabled:opacity-50 ${selDown ? "border-hair text-ok-ink hover:border-brand-500/40" : "border-bad/30 text-bad-ink hover:border-bad/60"}`}>{downBusy ? "…" : selDown ? "Bring back up" : "Mark down"}</button>
          <select value={selId} onChange={(e) => setSelId(e.target.value)} className="bg-inset border border-hair rounded-lg text-sm text-ink px-3 py-2 font-semibold outline-none focus:border-brand-500 max-w-[160px]">
            {active.map((m) => <option key={m.id} value={m.id}>{m.name}{isDown(m.id, downSet) ? " (down)" : ""}</option>)}
          </select>
        </div>
      }>
        {selDown && (
          <div className="mb-4 rounded-xl border border-bad/30 bg-bad-soft/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={16} className="text-bad-ink shrink-0" />
              <span className="font-semibold text-ink">{sel.name} is DOWN this month</span>
              {lines.length > 0 && <button onClick={moveAll} disabled={downBusy} className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-inset border border-hair text-ink hover:border-brand-500/40 transition disabled:opacity-40">{downBusy ? "Moving…" : "Move all to best free machines"}</button>}
            </div>
            <p className="text-ink-soft text-sm mb-3">{lines.length === 0 ? "Nothing was planned here — nothing to move." : <>Its <b className="text-ink">{lines.length}</b> part{lines.length === 1 ? "" : "s"} ({round1(selDays)}d) need to move to free machines. Pick a target for each, or move all.</>}</p>
            {lines.length > 0 && (
              <div className="space-y-2">
                {lines.map((l) => {
                  const lops = compOps(l.component_id);
                  const ld = componentCapacity(lops, l.qty).days;
                  const cands = suggestMachines({ componentId: l.component_id, ops: lops, qty: l.qty, ...reassignCtx(machinePlan) });
                  const fits = cands.filter((c) => c.fits).slice(0, 3);
                  return (
                    <div key={l.id} className="rounded-lg border border-hair bg-inset/60 p-3">
                      <div className="flex items-baseline gap-2 mb-2"><span className="font-semibold text-sm text-ink">{compName(l.component_id)}</span><span className="font-mono text-xs text-ink-dim">{l.qty} pcs · {round1(ld)}d</span></div>
                      {cands.length === 0
                        ? <div className="text-xs text-warn-ink">No eligible machine can run this part — keep it here or widen its allowed machines.</div>
                        : fits.length === 0
                          ? <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-bad-ink">No single free machine fits {round1(ld)}d.</span><button onClick={() => splitLine(l)} disabled={downBusy} className="text-xs font-semibold px-2.5 py-1 rounded bg-brand-500/15 border border-brand-500/40 text-ink hover:bg-brand-500/25 transition disabled:opacity-40">Split across machines</button></div>
                          : <div className="flex flex-wrap gap-1.5">
                              {fits.map((c) => (
                                <button key={c.machine.id} onClick={() => reassign(l, c.machine.id)} disabled={downBusy} title={`${round1(c.spare)}d free · ${round1(c.after)}d left after`} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-inset border border-hair text-ink-soft hover:text-ink hover:border-brand-500/50 transition disabled:opacity-40">→ {c.machine.name} <span className="text-ink-dim font-mono">({round1(c.spare)}d free)</span></button>
                              ))}
                              <button onClick={() => splitLine(l)} disabled={downBusy} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-inset border border-hair text-ink-dim hover:text-ink hover:border-brand-500/40 transition disabled:opacity-40">or split</button>
                            </div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4">
          <span className="text-ink-soft text-sm">Total load:</span>
          <span className={`font-mono text-2xl font-bold tnum ${loadTone(selPct).text}`}>{round1(selDays)}<span className="text-ink-dim text-base"> / {selCap} days</span></span>
          <div className="flex-1 min-w-[120px] max-w-[280px] h-2 rounded-full bg-over overflow-hidden"><div className={`h-full origin-left transition-transform duration-700 ease-out ${loadTone(selPct).bar}`} style={{ transform: `scaleX(${Math.min(selPct, 100) / 100})` }} /></div>
          <span className={`font-mono text-sm font-bold ${loadTone(selPct).text}`}>{selPct}%</span>
        </div>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[520px]">
            <thead><tr className="text-left font-mono text-ink-dim text-[10px] font-semibold uppercase tracking-[0.14em] border-b border-hair">
              <th className="py-2.5 px-2">Part</th><th className="py-2.5 px-2 text-right">Qty</th><th className="py-2.5 px-2 text-right">Ops</th><th className="py-2.5 px-2 text-right">Days</th><th className="py-2.5 px-2 w-10" />
            </tr></thead>
            <tbody>
              {lines.length === 0 ? <tr><td colSpan={5} className="py-5"><Empty msg={`Nothing planned on ${sel.name} yet — add a part below.`} /></td></tr>
                : lines.map((l, li) => {
                  const ops = compOps(l.component_id);
                  const d = componentCapacity(ops, l.qty).days;
                  const violates = !isAllowedOn(l.component_id, sel.id, componentMachines); // placed here but no longer allowed on this machine
                  return (
                    <tr key={l.id} className="border-b border-hair last:border-0 hover:bg-white/[0.025] transition">
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-1.5">
                          {/* run order — the Gantt schedules top-to-bottom */}
                          <span className="flex flex-col">
                            <button onClick={() => moveLine(l, -1)} disabled={li === 0} aria-label="Run earlier" className="p-0.5 text-ink-dim hover:text-ink disabled:opacity-25 transition"><CaretUp size={12} /></button>
                            <button onClick={() => moveLine(l, 1)} disabled={li === lines.length - 1} aria-label="Run later" className="p-0.5 text-ink-dim hover:text-ink disabled:opacity-25 transition"><CaretDown size={12} /></button>
                          </span>
                          <span className="font-semibold text-sm">{compName(l.component_id)}</span>
                          {violates && <button onClick={() => moveToEligible(l)} disabled={downBusy} title={`${compName(l.component_id)} isn't allowed on ${sel.name} — tap to move it to an eligible machine`} className="ml-1 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-bad-ink border border-bad/40 rounded px-1.5 py-0.5 hover:bg-bad-soft/30 transition disabled:opacity-40"><AlertTriangle size={10} />can't run here · move</button>}
                        </div>
                      </td>
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
            <select value={effCompId} onChange={(e) => { setCompId(e.target.value); setErr(""); }} disabled={eligibleComps.length === 0 || selDown} className={inputCls}>
              {eligibleComps.length === 0
                ? <option value="">No parts can run on {sel.name} — set compatibility below</option>
                : eligibleComps.map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` · ${c.code}` : ""}</option>)}
            </select>
          </div>
          <div className="flex gap-2.5 items-end">
            <div className="flex-1"><label className={labelCls}>Qty</label><input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="140" disabled={selDown} className={inputCls} /></div>
            <MetalButton onClick={addLine} disabled={!effCompId || !qty || busy || selDown} className="disabled:opacity-50 disabled:pointer-events-none">{busy ? "…" : <><Plus size={16} /> Add</>}</MetalButton>
          </div>
        </div>
        {/* live LOADABILITY check — can this machine take this part+qty? Hidden when
            the machine is DOWN (capacity 0 — fresh load can't go there). */}
        {selDown
          ? <div role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-bad/30 bg-bad-soft/20 px-3 py-2.5 text-sm text-bad-ink"><AlertTriangle size={15} className="shrink-0 mt-0.5" /><span>{sel.name} is down this month — you can't add new load here. Bring it back up, or add to an active machine.</span></div>
          : effCompId && qty && (() => {
          const pOps = compOps(effCompId);
          const need = componentCapacity(pOps, cleanInt(qty) ?? 0).days; // 3-shift-equiv days this part+qty needs
          const capRaw = machineCapacityDays(sel); // UNROUNDED — matches suggestMachines/loadability so a sub-0.1d rounding can't flip the loadable/over verdict
          const spare = capRaw - selDays;  // free days on the selected machine
          const after = spare - need;      // free days left if we add it
          const noOps = pOps.length === 0;
          const ok = after >= -1e-6;
          return (
            <div role="status" className={`mt-3 flex items-start gap-2 rounded-lg border border-hair bg-inset px-3 py-2.5 text-sm ${noOps ? "text-warn-ink" : ok ? "text-ok-ink" : "text-bad-ink"}`}>
              {noOps ? <><AlertTriangle size={15} className="shrink-0 mt-0.5" /><span>No operations defined for this part — add them in <b>Plan Setup → Routing</b> so the app can size its load.</span></>
                : ok ? <><Check size={15} className="shrink-0 mt-0.5" /><span><b>Loadable on {sel.name}</b> — needs {round1(need)}d; {round1(after)}d of {round1(Math.max(0, spare))}d free will remain after.</span></>
                : <><AlertTriangle size={15} className="shrink-0 mt-0.5" /><span><b>Over capacity</b> — needs {round1(need)}d but only {round1(Math.max(0, spare))}d is free ({round1(-after)}d over). You can still add it, but {sel.name} will be overbooked this month.</span></>}
            </div>
          );
        })()}
        {err && <div role="alert" className={`${errCls} mt-3`}><AlertTriangle size={15} className="shrink-0" />{err}</div>}
        <div className={`${hintCls} mt-3`}><Check size={14} className="shrink-0 mt-0.5 text-ok-ink" /><span>Each part's days come from its operations (Plan Setup → Routing). If a part shows "none" ops, define its operations there first. Over 100% means the machine is overbooked for the month.</span></div>
      </Panel>

      {/* Phase 3: auto schedule — operations sequenced with start/end dates */}
      <MachineSchedule machine={sel} lines={lines} operations={operations} components={components} month={month} />

      {/* Excel replica — the full plan sheet */}
      <MachineSheet machine={sel} lines={lines} operations={operations} components={components} month={month} />

      {/* Phase 5: costing (hour-rate vs target) */}
      <MachineCosting machine={sel} lines={lines} operations={operations} components={components} reload={reload} targetHr={Number(data.settings?.target_hr) || TARGET_HR} machineRate={Number(data.settings?.machine_rate) || 1200} />

      {/* Phase 4: plan vs actual (the sheet's Actual section) */}
      <MachinePlanVsActual machine={sel} lines={lines} operations={operations} components={components} entries={data.entries} />

      {/* machine eligibility — which machines each part may run on */}
      <Panel title="Part ↔ Machine compatibility" tag="07" className="mt-4">
        <p className="text-ink-soft text-sm mb-3 -mt-1">Tap a machine to toggle whether a part can run on it. A part with <b>all</b> machines lit runs anywhere (the default). Restrict a part and the rest disappear from its machine pickers and breakdown moves — <b>if it can't run there, it won't show.</b></p>
        <div className="space-y-2.5">
          {activeComps.map((c) => {
            const allowed = new Set(allowedMachines(c.id, componentMachines, active).map((mm) => mm.id));
            const restricted = (componentMachines || []).some((cm) => cm.component_id === c.id);
            return (
              <div key={c.id} className="rounded-lg border border-hair bg-inset/40 p-3">
                <div className="flex items-baseline gap-2 mb-2"><span className="font-semibold text-sm text-ink">{c.name}</span>{c.code && <span className="font-mono text-[11px] text-ink-dim">{c.code}</span>}<span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-ink-dim">{restricted ? `${allowed.size}/${active.length} machines` : "all machines"}</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {active.map((m) => {
                    const on = allowed.has(m.id);
                    return <button key={m.id} onClick={() => toggleEligibility(c.id, m.id)} title={on ? `${c.name} can run on ${m.name} — tap to disallow` : `${c.name} cannot run on ${m.name} — tap to allow`} className={`text-[11px] font-semibold px-2 py-1 rounded-md border transition ${on ? "bg-brand-500/15 border-brand-500/40 text-ink" : "bg-inset border-hair text-ink-dim hover:text-ink-soft line-through decoration-bad-ink/50"}`}>{m.name}</button>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

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

  // CONFIDENT match = the component's code appears as a whole token in the row
  // (word-boundary — never a loose substring that lets a short code collide).
  // FUZZY match = a name token matched, accepted ONLY when exactly one component
  // matches (no ambiguity), and flagged for review so a cycle-time can't silently
  // bind to the wrong part. Ambiguous (≥2 name matches) → unmatched on purpose.
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matchComp = (desc, comps) => {
    const d = (desc || "").toLowerCase();
    const dtoks = new Set(d.split(/[^a-z0-9]+/).filter(Boolean));
    for (const c of comps) {
      const code = String(c.code || "").toLowerCase();
      if (code && (dtoks.has(code) || new RegExp(`(^|[^a-z0-9])${esc(code)}([^a-z0-9]|$)`).test(d))) return { comp: c, fuzzy: false };
    }
    const hits = comps.filter((c) => {
      const toks = (c.name || "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3);
      return toks.some((t) => dtoks.has(t));
    });
    return hits.length === 1 ? { comp: hits[0], fuzzy: true } : { comp: null, fuzzy: false };
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
          const m = matchComp(desc, comps);
          const c = m.comp;
          const key = c ? `${c.id}|${opno}` : `?${desc}|${opno}`;
          found[key] = { desc, op_no: opno, cycle: cy, setup: st || 0, ins, comp: c, fuzzy: m.fuzzy };
        }
      }
      const list = Object.values(found).sort((a, b) => (a.comp?.name || a.desc).localeCompare(b.comp?.name || b.desc) || a.op_no - b.op_no);
      if (!list.length) { setErr("No operation rows found in a current-year plan sheet. Is this the HMC&VMC plan file?"); }
      else setPreview({ list, matched: list.filter((x) => x.comp).length, unmatched: list.filter((x) => !x.comp).length, fuzzy: list.filter((x) => x.comp && x.fuzzy).length });
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
          <div className="text-sm text-ink-soft mb-2"><b className="text-ink">{preview.matched}</b> operations matched to your parts{preview.unmatched ? `, ${preview.unmatched} unmatched (will be skipped)` : ""}{preview.fuzzy ? `, ${preview.fuzzy} matched by name only — check the “review” rows` : ""}:</div>
          <div className="max-h-56 overflow-y-auto border border-hair rounded-lg">
            <table className="w-full text-[12px]">
              <tbody>
                {preview.list.map((o, i) => (
                  <tr key={i} className="border-b border-hair last:border-0">
                    <td className="py-1.5 px-2.5 font-semibold">{o.comp ? <>{o.comp.name}{o.fuzzy && <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-warn-ink border border-hair rounded px-1.5 py-0.5">review</span>}</> : <span className="text-warn-ink">{o.desc} · no match</span>}</td>
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

// Editable settings: target hour-rate + per-machine working days / shifts /
// rename / retire / add. The machine fleet itself is managed here.
function SettingsPanel({ data, reload }) {
  const machines = (data.machines || []).filter((m) => m.active !== false);
  const [hr, setHr] = useState(String(data.settings?.target_hr || "2200"));
  const [mr, setMr] = useState(String(data.settings?.machine_rate || "1200"));
  const [saved, setSaved] = useState(false);
  const [savedMr, setSavedMr] = useState(false);
  const [sErr, setSErr] = useState("");
  const [newCode, setNewCode] = useState(""); const [addBusy, setAddBusy] = useState(false);
  const [retire, setRetire] = useState(null); const [retireBusy, setRetireBusy] = useState(false);
  const [showRetired, setShowRetired] = useState(false); const [retired, setRetired] = useState([]);
  const guard = async (fn) => { try { setSErr(""); await fn(); await reload(); } catch (e) { setSErr(e?.message || "That change didn't save — please retry."); } };
  const saveHr = () => { const h = cleanInt(hr); if (!h) return; guard(async () => { await db.setSetting("target_hr", h); setSaved(true); setTimeout(() => setSaved(false), 1500); }); };
  const saveMr = () => { const m = cleanInt(mr); if (!m) return; guard(async () => { await db.setSetting("machine_rate", m); setSavedMr(true); setTimeout(() => setSavedMr(false), 1500); }); };
  const saveMachine = (id, field, v) => guard(() => db.setMachine(id, { [field]: Math.max(1, parseInt(v, 10) || 1) }));
  const renameMachine = (id, v, old) => { const name = String(v || "").trim(); if (name && name !== old) guard(() => db.setMachine(id, { name })); };
  const addMachine = async () => {
    const code = newCode.trim();
    if (!code || addBusy) return;
    setAddBusy(true);
    try { setSErr(""); await db.addMachine({ code, name: code }); setNewCode(""); await reload(); }
    catch (e) { setSErr(e?.message || "Could not add the machine."); }
    finally { setAddBusy(false); }
  };
  const loadRetired = async () => { try { setRetired(((await db.listMachinesAll()) || []).filter((m) => m.active === false)); } catch { setRetired([]); } };
  const toggleRetired = async () => { const v = !showRetired; setShowRetired(v); if (v) await loadRetired(); };
  const confirmRetire = async () => {
    if (!retire || retireBusy) return;
    setRetireBusy(true);
    try { await db.setMachine(retire.id, { active: false }); await reload(); setRetire(null); if (showRetired) await loadRetired(); }
    catch (e) { setSErr(e?.message || "Could not retire the machine."); }
    finally { setRetireBusy(false); }
  };
  const restoreMachine = (id) => guard(async () => { await db.setMachine(id, { active: true }); await loadRetired(); });

  return (
    <Panel title="Settings — capacity & costing" tag="05" className="mt-4">
      <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mb-6">
        <div>
          <label className={labelCls}>Target hour-rate (₹/hr)</label>
          <div className="flex gap-2">
            <input type="number" min="0" value={hr} onChange={(e) => setHr(e.target.value)} className={inputCls} />
            <MetalButton onClick={saveHr} className="shrink-0">{saved ? <><Check size={16} /> Saved</> : "Save"}</MetalButton>
          </div>
          <p className="text-ink-dim text-xs mt-1.5">Your hour-rate goal — the Costing screen colours each part green at or above it.</p>
        </div>
        <div>
          <label className={labelCls}>Machine hour-rate (₹/hr)</label>
          <div className="flex gap-2">
            <input type="number" min="0" value={mr} onChange={(e) => setMr(e.target.value)} className={inputCls} />
            <MetalButton onClick={saveMr} className="shrink-0">{savedMr ? <><Check size={16} /> Saved</> : "Save"}</MetalButton>
          </div>
          <p className="text-ink-dim text-xs mt-1.5">What one machine-hour costs you — from the Excel header (1200).</p>
        </div>
      </div>

      <AnimatePresence>{sErr && <m.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: dur.pop, ease: ease.out }}><div role="alert" className={`${errCls} mb-4`}><AlertTriangle size={15} className="shrink-0" />{sErr}</div></m.div>}</AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <label className={labelCls}>Machines — name, working days &amp; shifts</label>
        <button onClick={toggleRetired} className="font-mono text-[11px] text-ink-dim hover:text-ink transition underline underline-offset-2">{showRetired ? "hide retired" : "show retired"}</button>
      </div>
      <div className="overflow-x-auto -mx-1 mt-1">
        <table className="w-full min-w-[520px]">
          <thead><tr className="text-left font-mono text-ink-dim text-[10px] font-semibold uppercase tracking-[0.14em] border-b border-hair">
            <th className="py-2.5 px-2">Machine</th><th className="py-2.5 px-2 text-right">Working days</th><th className="py-2.5 px-2 text-right">Shifts</th><th className="py-2.5 px-2 w-10" />
          </tr></thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id} className="border-b border-hair last:border-0">
                <td className="py-2 px-2"><input defaultValue={m.name} onBlur={(e) => renameMachine(m.id, e.target.value, m.name)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label={`Rename ${m.name}`} className="w-full min-w-[140px] px-2.5 py-2 min-h-[44px] bg-transparent border border-transparent hover:border-hair-strong focus:border-brand-500 focus:bg-inset rounded-lg font-semibold text-sm text-ink outline-none transition" /></td>
                <td className="py-2 px-2 text-right"><input type="number" min="1" defaultValue={m.working_days || 24} onBlur={(e) => saveMachine(m.id, "working_days", e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={`${cellCls} w-20`} /></td>
                <td className="py-2 px-2 text-right"><input type="number" min="1" max="3" defaultValue={m.shifts || 3} onBlur={(e) => saveMachine(m.id, "shifts", e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={`${cellCls} w-16`} /></td>
                <td className="py-2 px-2"><button onClick={() => setRetire(m)} aria-label={`Retire ${m.name}`} title="Retire machine" className="p-2 min-h-[44px] min-w-[44px] grid place-items-center rounded-lg text-ink-dim hover:bg-white/[0.06] hover:text-bad-ink transition"><Trash2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showRetired && (
        <div className="mt-3 border-t border-hair pt-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim mb-2">Retired machines</div>
          {retired.length === 0 ? <div className="text-ink-dim text-sm">None.</div> : (
            <ul className="divide-y divide-hair">
              {retired.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <span className="font-semibold text-sm text-ink-dim line-through">{m.name}</span>
                  <button onClick={() => restoreMachine(m.id)} className="ml-auto text-xs font-semibold px-3 py-1.5 min-h-[40px] rounded-lg bg-inset border border-hair text-ink-soft hover:text-ink hover:border-brand-500/40 transition">Restore</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="mt-4 flex gap-2.5 items-end max-w-md">
        <div className="flex-1"><label className={labelCls} htmlFor="new-machine">Add machine (code / name)</label><input id="new-machine" value={newCode} onChange={(e) => setNewCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMachine()} placeholder="e.g. VMC-3" className={inputCls} /></div>
        <MetalButton onClick={addMachine} disabled={!newCode.trim() || addBusy} className="disabled:opacity-50 disabled:pointer-events-none">{addBusy ? "…" : <><Plus size={16} /> Add</>}</MetalButton>
      </div>
      <div className={`${hintCls} mt-3`}><Check size={14} className="shrink-0 mt-0.5 text-ok-ink" /><span>Working days set each machine's monthly capacity on the Loading screen (default 24, Sundays off). Rename, retire or add machines here — retiring keeps all history and is reversible.</span></div>

      <ConfirmDialog
        open={!!retire}
        title="Retire this machine?"
        body={retire ? <>This hides <b className="text-ink">{retire.name}</b> from entry, loading and the dashboard. Its history is kept — restore it anytime via "show retired".</> : null}
        confirmLabel="Retire machine"
        danger
        busy={retireBusy}
        onConfirm={confirmRetire}
        onClose={() => { if (!retireBusy) setRetire(null); }}
      />
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
    if (busy || !opNo) return;
    const op = cleanInt(opNo);
    if (!op) { setErr("Operation number must be a positive whole number."); return; } // 0/blank/negative/NaN rejected
    setBusy(true); setErr("");
    try {
      await db.addOperation({ component_id: sel.id, op_no: op, description: desc.trim(), cycle_time: cleanNum(cyc) ?? 0, setup_time: cleanNum(setup) ?? 0, insertion_time: cleanNum(ins) ?? 0 });
      setOpNo(""); setDesc(""); setCyc(""); setSetup(""); setIns("60"); await reload();
    } catch (e) { setErr(e.message || "Failed to add operation"); }
    finally { setBusy(false); }
  };
  const editField = async (id, field, value) => {
    let v;
    if (field === "description") v = value;
    else { v = cleanNum(value); if (v === null) return; } // blank/negative/NaN → keep the saved value, don't corrupt it
    // surface failures — a silently-swallowed reject left the cell looking saved when it wasn't
    try { setErr(""); await db.updateOperation(id, { [field]: v }); await reload(); } catch (e) { setErr(e?.message || "That operation change didn't save — please retry."); }
  };
  const confirmDel = async () => {
    if (delBusy || !delOp) return; setDelBusy(true); setErr("");
    try { await db.removeOperation(delOp.id); await reload(); setDelOp(null); }
    catch (e) { setErr(e?.message || "Couldn't delete that operation — please retry."); } finally { setDelBusy(false); }
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

function PlanSetup({ data, reload, month = curMonth(), setMonth }) {
  const { components, plans } = data;
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [industry, setIndustry] = useState("railway");
  const [adding, setAdding] = useState(false);
  const [delComp, setDelComp] = useState(null); // component pending remove-confirm
  const [delBusy, setDelBusy] = useState(false);
  const [pErr, setPErr] = useState(""); // inline-edit failures must NOT be silent
  const [copyBusy, setCopyBusy] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [removed, setRemoved] = useState([]);

  const planFor = (cid) => plans.find((p) => p.component_id === cid);
  const guard = async (fn) => { try { setPErr(""); await fn(); await reload(); } catch (e) { setPErr(e?.message || "That change didn't save — please retry."); } };
  const changeTarget = (cid, v) => { const t = cleanPosInt(v); if (t === null) return; guard(() => db.upsertPlan({ month, component_id: cid, target_qty: t, working_days: planFor(cid)?.working_days ?? 24 })); };
  const changeWD = (cid, v) => { const wd = cleanInt(v); if (!wd) return; guard(() => db.upsertPlan({ month, component_id: cid, target_qty: planFor(cid)?.target_qty ?? 0, working_days: wd })); };
  const editComp = (id, fields) => guard(() => db.updateComponent(id, fields));
  const editRate = (id, v) => { const r = cleanNum(v); if (r === null) return; guard(() => db.setComponentRate(id, r)); };
  const addComponent = async () => { if (!name.trim() || adding) return; setAdding(true); try { await db.addComponent({ code: code.trim(), name: name.trim(), industry }); setName(""); setCode(""); setPErr(""); await reload(); } catch (e) { setPErr(e?.message || "Could not add the component."); } finally { setAdding(false); } };
  // Destructive: only runs after the focus-trapped ConfirmDialog is confirmed.
  const confirmRemoveComponent = async () => {
    if (delBusy || !delComp) return;
    setDelBusy(true);
    try { await db.deactivateComponent(delComp.id); await reload(); setDelComp(null); if (showRemoved) await loadRemoved(); }
    catch { /* leave the dialog open so the user can retry */ }
    finally { setDelBusy(false); }
  };
  const loadRemoved = async () => {
    try { setRemoved(((await db.listComponentsAll()) || []).filter((c) => c.active === false)); } catch { setRemoved([]); }
  };
  const toggleRemoved = async () => { const v = !showRemoved; setShowRemoved(v); if (v) await loadRemoved(); };
  const restoreComp = (id) => guard(async () => { await db.updateComponent(id, { active: true }); await loadRemoved(); });

  // Carry the previous month's plan forward — targets + working days AND the
  // per-machine loading lines. The monthly retype was the #1 rollover pain.
  const copyLastMonth = async () => {
    if (copyBusy) return;
    setCopyBusy(true); setPErr("");
    try {
      const prev = addMonths(month, -1);
      const [prevPlans, prevLines] = await Promise.all([db.getPlans(prev), db.listMachinePlanLines ? db.listMachinePlanLines(prev) : Promise.resolve([])]);
      if (!prevPlans.length && !prevLines.length) { setPErr(`Nothing planned in ${prettyMonth(prev)} to copy.`); return; }
      for (const p of prevPlans) await db.upsertPlan({ month, component_id: p.component_id, target_qty: p.target_qty, working_days: p.working_days });
      const existing = data.machinePlan || [];
      // run-order is PER MACHINE — seed each machine's next seq from its own max(seq)+1
      // (not the global array length, which collided with existing lines / seq gaps).
      const nextSeq = {};
      for (const x of existing) nextSeq[x.machine_id] = Math.max(nextSeq[x.machine_id] ?? -1, Number(x.seq) || 0);
      for (const l of prevLines) {
        if (existing.some((x) => x.machine_id === l.machine_id && x.component_id === l.component_id)) continue;
        const seq = (nextSeq[l.machine_id] = (nextSeq[l.machine_id] ?? -1) + 1);
        await db.addMachinePlanLine({ month, machine_id: l.machine_id, component_id: l.component_id, qty: l.qty, seq });
      }
      await reload();
    } catch (e) { setPErr(e?.message || "Copy failed — please retry."); }
    finally { setCopyBusy(false); }
  };

  return (
    <>
      <PageHead title="Plan Setup" sub={`${prettyMonth(month)} · daily & per-shift targets are auto-calculated`} icon={Settings2} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 mt-6">
        <Panel title="Planning Period" tag="01">
          <label className={labelCls} htmlFor="plan-month">Plan Month</label>
          <input id="plan-month" type="month" value={month} onChange={(e) => setMonth && e.target.value && setMonth(e.target.value)} className={`${inputCls} mb-3`} />
          {plans.length === 0 && (
            <MetalButton onClick={copyLastMonth} disabled={copyBusy} fullWidth className="mb-3 disabled:opacity-50 disabled:pointer-events-none">
              {copyBusy ? "Copying…" : <><Copy size={16} /> Copy {prettyMonth(addMonths(month, -1))}'s plan</>}
            </MetalButton>
          )}
          <div className="bg-inset border border-hair rounded-xl p-4 text-sm text-ink leading-relaxed">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-300/80 mb-1.5">Note</div>
            Each component has its own <b>monthly target</b> and <b>working days</b>. Daily target = target ÷ working days, then split across the 3 shifts. Pick a future month here (or with the ‹ › header switcher) to pre-plan it.
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

      <AnimatePresence>{pErr && <m.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: dur.pop, ease: ease.out }}><div role="alert" className={`${errCls} mb-4`}><AlertTriangle size={15} className="shrink-0" />{pErr}</div></m.div>}</AnimatePresence>

      <Panel title="Components, Targets & Working Days" tag="03" right={
        <button onClick={toggleRemoved} className="font-mono text-[11px] text-ink-dim hover:text-ink transition underline underline-offset-2">{showRemoved ? "hide removed" : "show removed"}</button>
      }>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[820px]">
            <thead><tr className="text-left font-mono text-ink-dim text-[10px] font-semibold uppercase tracking-[0.15em] border-b border-hair">
              <th className="py-2.5 px-2.5">Component</th><th className="py-2.5 px-2.5">Code</th><th className="py-2.5 px-2.5">Industry</th>
              <th className="py-2.5 px-2.5 text-right">Monthly Target</th><th className="py-2.5 px-2.5 text-right">Working Days</th>
              <th className="py-2.5 px-2.5 text-right">Rate ₹/pc</th>
              <th className="py-2.5 px-2.5 text-right">Daily</th><th className="py-2.5 px-2.5 text-right">Per Shift</th><th className="py-2.5 px-2.5 w-10" />
            </tr></thead>
            <tbody>
              {components.map((c) => {
                const p = planFor(c.id); const target = p?.target_qty ?? 0; const wd = p?.working_days || 24; const daily = target / wd;
                return (
                  <tr key={c.id} className="border-b border-hair last:border-0 hover:bg-white/[0.025] transition">
                    <td className="py-3 px-2.5"><input defaultValue={c.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) editComp(c.id, { name: v }); else e.target.value = c.name; }} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label={`Name of ${c.name}`} className="w-full min-w-[150px] px-2.5 py-2 min-h-[44px] bg-transparent border border-transparent hover:border-hair-strong focus:border-brand-500 focus:bg-inset rounded-lg font-semibold text-sm text-ink outline-none transition" /></td>
                    <td className="py-3 px-2.5"><input defaultValue={c.code || ""} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (c.code || "")) editComp(c.id, { code: v || null }); }} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label={`Code of ${c.name}`} className="w-24 px-2.5 py-2 min-h-[44px] bg-transparent border border-transparent hover:border-hair-strong focus:border-brand-500 focus:bg-inset rounded-lg font-mono text-xs text-ink-soft outline-none transition" /></td>
                    <td className="py-3 px-2.5">
                      <select defaultValue={c.industry || ""} onChange={(e) => editComp(c.id, { industry: e.target.value || null })} aria-label={`Industry of ${c.name}`} className="bg-inset border border-hair rounded-lg text-xs text-ink-soft px-2 py-2 min-h-[44px] capitalize outline-none focus:border-brand-500">
                        <option value="">—</option>
                        {["railway", "wind", "marine", "other"].map((i) => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </td>
                    <td className="py-3 px-2.5 text-right"><input type="number" min="0" defaultValue={target} onBlur={(e) => changeTarget(c.id, e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={cellCls} /></td>
                    <td className="py-3 px-2.5 text-right"><input type="number" min="1" defaultValue={wd} onBlur={(e) => changeWD(c.id, e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={cellCls} /></td>
                    <td className="py-3 px-2.5 text-right"><input type="number" min="0" defaultValue={c.rate || 0} onBlur={(e) => { if ((parseFloat(e.target.value) || 0) !== (c.rate || 0)) editRate(c.id, e.target.value); }} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label={`Rate of ${c.name}`} className={cellCls} /></td>
                    <td className="py-3 px-2.5 text-right font-bold text-brand-300 font-mono tnum">{daily.toFixed(1)}</td>
                    <td className="py-3 px-2.5 text-right text-ink-soft font-mono tnum">{(daily / 3).toFixed(1)}</td>
                    <td className="py-3 px-2.5"><button onClick={() => setDelComp(c)} aria-label={`Remove ${c.name}`} className="p-2 min-h-[44px] min-w-[44px] grid place-items-center rounded-lg text-ink-dim hover:bg-white/[0.06] hover:text-bad-ink transition"><Trash2 size={15} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {showRemoved && (
          <div className="mt-3 border-t border-hair pt-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim mb-2">Removed components</div>
            {removed.length === 0 ? <div className="text-ink-dim text-sm">None.</div> : (
              <ul className="divide-y divide-hair">
                {removed.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <span className="font-semibold text-sm text-ink-dim line-through">{c.name}</span>
                    {c.code && <span className="font-mono text-xs text-ink-dim">{c.code}</span>}
                    <button onClick={() => restoreComp(c.id)} className="ml-auto text-xs font-semibold px-3 py-1.5 min-h-[40px] rounded-lg bg-inset border border-hair text-ink-soft hover:text-ink hover:border-brand-500/40 transition">Restore</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className={`${hintCls} mt-3`}><Check size={14} className="shrink-0 mt-0.5 text-ok-ink" /><span>Every cell is editable — name, code, industry, target, working days and rate save when you click away (or press Enter). Removing a component hides it; restore it anytime via "show removed".</span></div>
      </Panel>

      <div className="mt-4"><OperationsPanel data={data} reload={reload} /></div>
      <SettingsPanel data={data} reload={reload} />
      <ExcelImport data={data} reload={reload} />

      <ConfirmDialog
        open={!!delComp}
        title="Remove this component?"
        body={delComp ? <>This hides <b className="text-ink">{delComp.name}</b>{delComp.code ? ` (${delComp.code})` : ""} from entry and planning. Its production history is kept — restore it anytime via "show removed".</> : null}
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
          <m.div ref={ref} role="dialog" aria-modal="true" aria-labelledby="confirm-dlg-title" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10, transition: exitTween(dur.modal) }} transition={spring.modal} className="bg-over border border-hair-strong relative overflow-hidden rounded-[10px] p-6 w-full max-w-sm shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 id="confirm-dlg-title" className="font-display font-bold text-lg">{title}</h3>
              <button onClick={onClose} aria-label="Cancel" className="p-2 min-h-[44px] min-w-[44px] grid place-items-center rounded-lg text-ink-dim hover:bg-white/[0.06]"><X size={18} /></button>
            </div>
            {body && <div className="text-sm text-ink-soft leading-relaxed mb-5">{body}</div>}
            <div className="flex gap-3">
              <m.button onClick={onClose} disabled={busy} whileTap={{ scale: 0.97 }} transition={spring.tap} className={`${btnSecondary} flex-1 !py-3.5`}>Cancel</m.button>
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
      <m.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.85, ease: ease.out }} className="h-full rounded-[1px] origin-left" style={{ width: `${Math.min(pct, 100)}%`, background: fill }} />
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
    <m.div variants={itemV} whileHover={{ y: -3 }} transition={spring.card} onPointerMove={spotlightMove}
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
