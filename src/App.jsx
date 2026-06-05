import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area, ReferenceLine, Legend,
} from "recharts";
import {
  LayoutDashboard, ClipboardList, Settings2, Plus, Trash2, Check, LogOut, X,
  Gauge, Factory, TrendingUp, TrendingDown, Clock, Package, ArrowRight, Target,
  AlertTriangle, ShieldCheck, HardHat, Delete, Minus,
} from "lucide-react";
import { db, seedIfEmpty } from "./lib/db";

/* ============================================================================
   PRANA VENTURE — Production Tracking · Phase 1 MVP  (React + Tailwind)
   Data model = Path A (Supabase / PostgreSQL): 5 tables
     users · machines · components · monthly_plans · production_entries
   State kept local (browser persistence) so it runs with NO Supabase keys.
   To go live: replace ONLY the `db` object — each method shows its Supabase
   query in a comment. The UI calls db.* (async) and never changes.
============================================================================ */

const SHIFTS = [
  { id: 1, label: "Shift 1", time: "06:00 – 14:00" },
  { id: 2, label: "Shift 2", time: "14:00 – 22:00" },
  { id: 3, label: "Shift 3", time: "22:00 – 06:00" }, // crosses midnight
];
const todayStr = () => new Date().toISOString().slice(0, 10);
const curMonth = () => todayStr().slice(0, 7);
/* ----------------------------- helpers ------------------------------------ */
const HEX = { indigo: "#6366f1", teal: "#14b8a6", amber: "#f59e0b", violet: "#8b5cf6", emerald: "#10b981", rose: "#f43f5e", s2: "#e2e8f0", s4: "#94a3b8", s5: "#64748b" };
const pctHex = (p) => (p >= 100 ? HEX.emerald : p >= 70 ? HEX.amber : HEX.rose);
const pctBar = (p) => (p >= 100 ? "bg-emerald-500" : p >= 70 ? "bg-amber-500" : "bg-rose-500");
const pctText = (p) => (p >= 100 ? "text-emerald-600" : p >= 70 ? "text-amber-600" : "text-rose-600");
const prettyMonth = (m) => { const [y, mo] = m.split("-"); return new Date(y, mo - 1).toLocaleString("en", { month: "long", year: "numeric" }); };
const tip = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12, boxShadow: "0 6px 20px rgba(15,23,42,0.1)" };
const FONT = { fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif" };

/* ============================================================================
   APP
============================================================================ */
export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [data, setData] = useState({ components: [], machines: [], plans: [], entries: [] });

  useEffect(() => { (async () => { await seedIfEmpty(); setBooting(false); })(); }, []);

  const loadData = useCallback(async () => {
    const [components, machines] = await Promise.all([db.listComponents(), db.listMachines()]);
    const [plans, entries] = await Promise.all([db.getPlans(curMonth()), db.listEntries({ month: curMonth() })]);
    setData({ components, machines, plans, entries });
  }, []);

  const onLogin = async (u) => { setUser(u); setView(u.role === "operator" ? "entry" : "dashboard"); await loadData(); };
  const logout = () => { setUser(null); setView("dashboard"); };

  if (booting) return <div style={FONT} className="min-h-screen bg-slate-100 grid place-items-center text-slate-500"><Fonts />Starting…</div>;
  if (!user) return <LoginScreen onLogin={onLogin} />;

  return (
    <div style={FONT} className="min-h-screen bg-slate-100 text-slate-800">
      <Fonts />
      <Header user={user} view={view} setView={setView} logout={logout} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {view === "dashboard" && <Dashboard data={data} />}
        {view === "entry" && <ShiftEntry data={data} user={user} reload={loadData} />}
        {view === "plan" && <PlanSetup data={data} reload={loadData} />}
      </main>
    </div>
  );
}

/* ------------------------------ Login ------------------------------------- */
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("operator");
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const press = (d) => { setErr(""); setPin((p) => (p.length < 6 ? p + d : p)); };
  const back = () => setPin((p) => p.slice(0, -1));
  const pinLogin = async () => { const u = await db.loginByPin(pin); u ? onLogin(u) : (setErr("Invalid PIN. Demo: 1001 / 1002 / 1003"), setPin("")); };
  const credLogin = async () => { const u = await db.loginByCredentials(username, password); u ? onLogin(u) : setErr("Wrong username or password."); };

  const tab = (id, label) => (
    <button onClick={() => { setMode(id); setErr(""); }}
      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${mode === id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}>{label}</button>
  );

  return (
    <div style={FONT} className="min-h-screen grid place-items-center p-5 bg-gradient-to-b from-indigo-50 to-slate-100">
      <Fonts />
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-200 p-7">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 grid place-items-center shadow-md"><Factory size={22} className="text-white" /></div>
          <div>
            <div className="font-extrabold text-lg tracking-wide leading-none">PRANA VENTURE</div>
            <div className="text-slate-400 text-xs mt-1">Production Planning &amp; Tracking</div>
          </div>
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-5">{tab("operator", "Operator")}{tab("manager", "Manager")}</div>

        {mode === "operator" ? (
          <>
            <div className="text-center text-slate-500 text-sm font-semibold mb-3">Enter your PIN</div>
            <div className="h-12 mb-4 rounded-xl bg-slate-50 border-2 border-slate-200 flex items-center justify-center gap-2">
              {pin.length === 0 ? <span className="text-slate-300 text-sm">• • • •</span> :
                pin.split("").map((_, i) => <span key={i} className="w-3 h-3 rounded-full bg-indigo-500" />)}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button key={n} onClick={() => press(String(n))} className="h-16 rounded-2xl bg-slate-50 border border-slate-200 text-2xl font-bold text-slate-700 active:bg-indigo-50 active:scale-95 transition">{n}</button>
              ))}
              <button onClick={back} className="h-16 rounded-2xl bg-slate-50 border border-slate-200 grid place-items-center text-slate-500 active:bg-slate-100"><Delete size={22} /></button>
              <button onClick={() => press("0")} className="h-16 rounded-2xl bg-slate-50 border border-slate-200 text-2xl font-bold text-slate-700 active:bg-indigo-50 active:scale-95 transition">0</button>
              <button onClick={pinLogin} className="h-16 rounded-2xl bg-indigo-500 grid place-items-center text-white active:bg-indigo-600"><ArrowRight size={24} /></button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-500 text-sm font-semibold mb-1.5">Username</label>
              <input value={username} onChange={(e) => { setUsername(e.target.value); setErr(""); }} placeholder="anita / admin" className={inputCls} />
            </div>
            <div>
              <label className="block text-slate-500 text-sm font-semibold mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && credLogin()} placeholder="••••••••" className={inputCls} />
            </div>
            <button onClick={credLogin} className={btnPrimary}>Login <ArrowRight size={18} /></button>
            <div className="text-center text-xs text-slate-400">Demo · anita / anita123 · admin / admin123</div>
          </div>
        )}

        {err && <div className="mt-4 flex items-center gap-2 text-rose-600 text-sm bg-rose-50 px-3 py-2.5 rounded-xl"><AlertTriangle size={15} />{err}</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Header ------------------------------------ */
function Header({ user, view, setView, logout }) {
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["supervisor", "admin"] },
    { id: "entry", label: "Shift Entry", icon: ClipboardList, roles: ["operator", "supervisor", "admin"] },
    { id: "plan", label: "Plan Setup", icon: Settings2, roles: ["supervisor", "admin"] },
  ].filter((t) => t.roles.includes(user.role));
  const meta = { operator: ["text-teal-600", "bg-teal-50", HardHat], supervisor: ["text-indigo-600", "bg-indigo-50", ShieldCheck], admin: ["text-violet-600", "bg-violet-50", ShieldCheck] }[user.role];

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 grid place-items-center shadow-md"><Factory size={20} className="text-white" /></div>
          <div>
            <div className="font-extrabold text-base tracking-wide leading-none">PRANA VENTURE</div>
            <div className="text-slate-400 text-xs mt-0.5">Production Tracking</div>
          </div>
        </div>

        <nav className="flex gap-1 bg-slate-100 p-1.5 rounded-2xl order-3 sm:order-2 w-full sm:w-auto">
          {tabs.map((t) => {
            const a = view === t.id; const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setView(t.id)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${a ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}>
                <Icon size={16} /><span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 order-2 sm:order-3">
          <div className="text-right">
            <div className="font-bold text-sm leading-tight">{user.name}</div>
            <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${meta[0]} ${meta[1]}`}>{user.role}</span>
          </div>
          <button onClick={logout} title="Log out" className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"><LogOut size={18} /></button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------ Dashboard --------------------------------- */
function Dashboard({ data }) {
  const { components, plans, entries } = data;
  const planFor = (cid) => plans.find((p) => p.component_id === cid);

  const totalMonthly = plans.reduce((s, p) => s + p.target_qty, 0);
  const dailyTargetTotal = plans.reduce((s, p) => s + p.target_qty / p.working_days, 0);
  const actualMonthly = entries.reduce((s, e) => s + e.quantity, 0);
  const today = todayStr();
  const todayEntries = entries.filter((e) => e.production_date === today);
  const actualToday = todayEntries.reduce((s, e) => s + e.quantity, 0);
  const monthlyPct = totalMonthly ? Math.round((actualMonthly / totalMonthly) * 100) : 0;
  const dailyPct = dailyTargetTotal ? Math.round((actualToday / dailyTargetTotal) * 100) : 0;

  const dayOfMonth = new Date().getDate();
  const expectedSoFar = Math.min(dailyTargetTotal * dayOfMonth, totalMonthly);
  const pace = expectedSoFar ? actualMonthly / expectedSoFar : 1;
  const onPace = pace >= 0.97;

  const compData = components.map((c) => {
    const p = planFor(c.id); const target = p ? p.target_qty : 0;
    const actual = entries.filter((e) => e.component_id === c.id).reduce((s, e) => s + e.quantity, 0);
    return { name: c.name, target, actual, pct: target ? Math.round((actual / target) * 100) : 0 };
  }).filter((d) => d.target > 0 || d.actual > 0);

  const byDay = {};
  entries.forEach((e) => { byDay[e.production_date] = (byDay[e.production_date] || 0) + e.quantity; });
  const trend = Object.keys(byDay).sort().map((d) => ({ day: d.slice(8), actual: byDay[d] }));
  const shiftData = SHIFTS.map((s) => ({ ...s, qty: todayEntries.filter((e) => e.shift === s.id).reduce((sum, e) => sum + e.quantity, 0) }));

  return (
    <>
      <PageHead title="Production Overview" sub={`${prettyMonth(curMonth())} · live`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi title="Monthly Plan" value={totalMonthly} unit="units" Icon={Package} color="text-indigo-600" soft="bg-indigo-50" />
        <Kpi title="Produced (MTD)" value={actualMonthly} unit="units" Icon={Gauge} color="text-teal-600" soft="bg-teal-50" foot={`${monthlyPct}% of plan achieved`} footColor="text-teal-600" />
        <Kpi title="Today's Target" value={Math.round(dailyTargetTotal)} unit="units" Icon={Clock} color="text-amber-600" soft="bg-amber-50" foot={`${actualToday} produced today`} footColor="text-amber-600" />
        <Kpi title="On-track Status" value={`${Math.round(pace * 100)}%`} Icon={onPace ? TrendingUp : TrendingDown} color={onPace ? "text-emerald-600" : "text-rose-600"} soft={onPace ? "bg-emerald-50" : "bg-rose-50"} foot={onPace ? "On track vs plan" : "Behind schedule"} footColor={onPace ? "text-emerald-600" : "text-rose-600"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Panel title="Plan vs Actual — by Component (Monthly)" dot="bg-indigo-500">
          {compData.length === 0 ? <Empty msg="Set monthly targets in Plan Setup to see this." /> : (
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={compData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={HEX.s2} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: HEX.s5, fontSize: 11 }} axisLine={{ stroke: HEX.s2 }} tickLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis tick={{ fill: HEX.s4, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tip} cursor={{ fill: "rgba(99,102,241,0.06)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="target" name="Plan" fill={HEX.s2} radius={[5, 5, 0, 0]} />
                <Bar dataKey="actual" name="Actual" radius={[5, 5, 0, 0]}>{compData.map((d, i) => <Cell key={i} fill={pctHex(d.pct)} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Daily Output Trend" dot="bg-teal-500">
          {trend.length === 0 ? <Empty msg="No production logged yet this month." /> : (
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={HEX.teal} stopOpacity={0.35} /><stop offset="100%" stopColor={HEX.teal} stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={HEX.s2} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: HEX.s5, fontSize: 11 }} axisLine={{ stroke: HEX.s2 }} tickLine={false} />
                <YAxis tick={{ fill: HEX.s4, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tip} />
                <ReferenceLine y={Math.round(dailyTargetTotal)} stroke={HEX.amber} strokeDasharray="5 4" label={{ value: "Daily target", fill: HEX.amber, fontSize: 10, position: "insideTopRight" }} />
                <Area type="monotone" dataKey="actual" name="Output" stroke={HEX.teal} strokeWidth={2.5} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title={`Today — Plan vs Actual · ${today}`} dot="bg-amber-500">
          <div className="flex items-end justify-between mb-2">
            <div><div className="text-slate-400 text-xs font-semibold">Actual</div><div className="text-3xl font-extrabold">{actualToday}</div></div>
            <div className="text-right"><div className="text-slate-400 text-xs font-semibold">Target</div><div className="text-3xl font-extrabold text-slate-400">{Math.round(dailyTargetTotal)}</div></div>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-1"><div className={`h-full rounded-full ${pctBar(dailyPct)}`} style={{ width: `${Math.min(dailyPct, 100)}%` }} /></div>
          <div className={`text-xs font-semibold mb-4 ${pctText(dailyPct)}`}>{dailyPct}% of today's target</div>
          <div className="grid grid-cols-3 gap-3">
            {shiftData.map((s, i) => {
              const c = ["bg-indigo-50 text-indigo-600", "bg-teal-50 text-teal-600", "bg-violet-50 text-violet-600"][i];
              return (
                <div key={s.id} className={`rounded-2xl p-3 text-center ${c.split(" ")[0]}`}>
                  <div className={`text-xs font-bold ${c.split(" ")[1]}`}>{s.label}</div>
                  <div className="text-slate-400 text-[10px] mb-1.5">{s.time}</div>
                  <div className={`text-3xl font-extrabold ${c.split(" ")[1]}`}>{s.qty}</div>
                  <div className="text-slate-400 text-[11px]">units</div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Component Performance (Monthly)" dot="bg-violet-500">
          {compData.length === 0 ? <Empty msg="No components with targets yet." /> : (
            <div className="space-y-3.5">
              {compData.map((c) => (
                <div key={c.name}>
                  <div className="flex justify-between text-sm mb-1.5"><span className="font-semibold text-slate-700">{c.name}</span><span className="text-slate-500">{c.actual}/{c.target} · <b className={pctText(c.pct)}>{c.pct}%</b></span></div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pctBar(c.pct)}`} style={{ width: `${Math.min(c.pct, 100)}%` }} /></div>
                </div>
              ))}
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

  useEffect(() => { if (!componentId && components[0]) setComponentId(components[0].id); }, [components]);
  useEffect(() => { if (!machineId && machines[0]) setMachineId(machines[0].id); }, [machines]);

  const isManager = user.role !== "operator";
  const compName = (id) => components.find((c) => c.id === id)?.name || "—";
  const machName = (id) => machines.find((m) => m.id === id)?.code || "—";

  // BUSINESS RULE: flag duplicate for same operator/component/shift/date
  const dup = entries.find((e) => e.production_date === date && e.shift === shift && e.component_id === componentId && e.operator_id === user.id);

  const open = () => { if (componentId && qty >= 0) setConfirm(true); };
  const doSave = async () => {
    await db.addEntry({ production_date: date, shift, component_id: componentId, machine_id: machineId || null, operator_id: user.id, quantity: Number(qty), scrap_qty: Number(scrap), notes: notes.trim() });
    setConfirm(false); setQty(0); setScrap(0); setNotes("");
    setToast(`Recorded ${compName(componentId)} · ${shift ? "Shift " + shift : ""}`); setTimeout(() => setToast(""), 1800);
    await reload();
  };

  let recent = [...entries].sort((a, b) => b.created_at - a.created_at);
  if (!isManager) recent = recent.filter((e) => e.operator_id === user.id);
  recent = recent.slice(0, 9);

  const Stepper = ({ value, set, accent }) => (
    <div className="flex items-center gap-3">
      <button onClick={() => set(Math.max(0, value - 1))} className={`w-14 h-14 rounded-2xl grid place-items-center text-2xl active:scale-95 transition ${accent}`}><Minus size={24} /></button>
      <input type="number" min="0" value={value} onChange={(e) => set(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-24 text-center text-4xl font-extrabold bg-slate-50 border-2 border-slate-200 rounded-2xl py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none" />
      <button onClick={() => set(value + 1)} className={`w-14 h-14 rounded-2xl grid place-items-center text-2xl active:scale-95 transition ${accent}`}><Plus size={24} /></button>
    </div>
  );

  return (
    <>
      <PageHead title="Shift Entry" sub={`Logging as ${user.name} · output is recorded against the date the shift started`} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Record Output" dot="bg-indigo-500">
          <label className={labelCls}>Production Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} mb-4`} />

          <label className={labelCls}>Shift</label>
          <div className="grid grid-cols-3 gap-3 mb-2">
            {SHIFTS.map((s) => (
              <button key={s.id} onClick={() => setShift(s.id)} className={`py-4 rounded-2xl border-2 text-center transition active:scale-95 ${shift === s.id ? "border-indigo-500 bg-indigo-50 text-indigo-600" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                <div className="font-bold text-base">{s.label}</div><div className="text-[11px] opacity-80">{s.time}</div>
              </button>
            ))}
          </div>
          {shift === 3 && <div className={`${hintCls} mb-4`}>Shift 3 runs past midnight — log it under the day it <b>started</b>.</div>}
          <div className="mb-4" />

          <label className={labelCls}>Component</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
            {components.map((c) => (
              <button key={c.id} onClick={() => setComponentId(c.id)} className={`px-3 py-3 rounded-2xl border-2 text-left transition active:scale-95 ${componentId === c.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}>
                <div className="font-bold text-sm text-slate-700 leading-tight">{c.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 capitalize">{c.industry}</div>
              </button>
            ))}
          </div>

          <label className={labelCls}>Machine</label>
          <div className="flex flex-wrap gap-2 mb-5">
            {machines.map((m) => (
              <button key={m.id} onClick={() => setMachineId(m.id)} className={`px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition ${machineId === m.id ? "border-indigo-500 bg-indigo-50 text-indigo-600" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{m.code}</button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className={labelCls}>Quantity Produced</label><Stepper value={qty} set={setQty} accent="bg-indigo-50 text-indigo-600" /></div>
            <div><label className={labelCls}>Scrap (optional)</label><Stepper value={scrap} set={setScrap} accent="bg-rose-50 text-rose-500" /></div>
          </div>

          <label className={labelCls}>Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Tool change, machine issue, etc." className={`${inputCls} mb-4 resize-none`} />

          {dup && <div className={`${warnCls} mb-3`}><AlertTriangle size={16} className="shrink-0" /><span>You already logged <b>{compName(componentId)}</b> for Shift {shift} on this date. You'll be asked to confirm.</span></div>}

          <button onClick={open} className={`${btnPrimary} text-lg py-4`}>Record Output <ArrowRight size={20} /></button>
        </Panel>

        <Panel title={isManager ? "Recent Entries (all operators)" : "My Recent Entries"} dot="bg-teal-500">
          {recent.length === 0 && <Empty msg="No entries yet — log your first one." />}
          <div className="space-y-2">
            {recent.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-3.5 py-3 bg-slate-50 rounded-xl">
                <div>
                  <div className="font-semibold text-sm text-slate-700">{compName(e.component_id)}</div>
                  <div className="text-[11px] text-slate-400">{e.production_date} · Shift {e.shift} · {machName(e.machine_id)}{e.scrap_qty ? ` · ${e.scrap_qty} scrap` : ""}{e.notes ? " · 📝" : ""}</div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="bg-teal-50 text-teal-600 font-bold text-sm px-2.5 py-1 rounded-full whitespace-nowrap">{e.quantity} units</span>
                  {isManager && <button onClick={async () => { await db.removeEntry(e.id); await reload(); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-rose-500 transition"><Trash2 size={15} /></button>}
                </div>
              </div>
            ))}
          </div>
          {!isManager && <div className={`${hintCls} mt-3`}>Only a supervisor can edit or delete entries.</div>}
        </Panel>
      </div>

      {/* Confirmation */}
      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={() => setConfirm(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-extrabold text-lg">Confirm entry</h3><button onClick={() => setConfirm(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button></div>
            <div className="space-y-2.5 mb-5">
              {[["Date", date], ["Shift", `Shift ${shift}`], ["Component", compName(componentId)], ["Machine", machName(machineId)], ["Quantity", `${qty} units`], ["Scrap", `${scrap} units`]].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm"><span className="text-slate-400 font-medium">{k}</span><span className="font-bold text-slate-700">{v}</span></div>
              ))}
              {notes && <div className="text-sm pt-1"><span className="text-slate-400 font-medium">Notes</span><div className="text-slate-700 mt-0.5">{notes}</div></div>}
            </div>
            {dup && <div className={`${warnCls} mb-4`}><AlertTriangle size={16} className="shrink-0" /><span>A matching entry already exists for this shift. Confirm only if this is additional output.</span></div>}
            <div className="flex gap-3">
              <button onClick={() => setConfirm(false)} className="flex-1 py-3.5 rounded-2xl bg-slate-100 font-bold text-slate-600 active:scale-95 transition">Cancel</button>
              <button onClick={doSave} className="flex-1 py-3.5 rounded-2xl bg-indigo-500 text-white font-bold active:scale-95 transition flex items-center justify-center gap-2"><Check size={18} /> Confirm</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 font-semibold text-sm"><Check size={18} />{toast}</div>
      )}
    </>
  );
}

/* ------------------------------ Plan Setup -------------------------------- */
function PlanSetup({ data, reload }) {
  const { components, plans } = data;
  const month = curMonth();
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [industry, setIndustry] = useState("railway");

  const planFor = (cid) => plans.find((p) => p.component_id === cid);
  const changeTarget = async (cid, v) => { const p = planFor(cid); await db.upsertPlan({ month, component_id: cid, target_qty: parseInt(v, 10) || 0, working_days: p?.working_days ?? 26 }); await reload(); };
  const changeWD = async (cid, v) => { const p = planFor(cid); await db.upsertPlan({ month, component_id: cid, target_qty: p?.target_qty ?? 0, working_days: Math.max(1, parseInt(v, 10) || 1) }); await reload(); };
  const addComponent = async () => { if (!name.trim()) return; await db.addComponent({ code: code.trim(), name: name.trim(), industry }); setName(""); setCode(""); await reload(); };
  const removeComponent = async (id) => { await db.deactivateComponent(id); await reload(); };

  return (
    <>
      <PageHead title="Plan Setup" sub={`${prettyMonth(month)} · daily & per-shift targets are auto-calculated`} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Panel title="Planning Period" dot="bg-indigo-500">
          <label className={labelCls}>Plan Month</label>
          <input value={prettyMonth(month)} disabled className={`${inputCls} opacity-70 mb-4`} />
          <div className="flex gap-2.5 items-start bg-indigo-50 rounded-2xl p-4 text-sm text-slate-700 leading-relaxed">
            <Target size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <span>Each component has its own <b>monthly target</b> and <b>working days</b> for this month. Daily target = target ÷ working days, then split across the 3 shifts.</span>
          </div>
        </Panel>

        <Panel title="Add New Component" dot="bg-teal-500">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="col-span-2"><label className={labelCls}>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Clamping Plate" className={inputCls} /></div>
            <div><label className={labelCls}>Code</label><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CP-100" className={inputCls} /></div>
          </div>
          <label className={labelCls}>Industry</label>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={`${inputCls} mb-4`}>
            <option value="railway">Railway</option><option value="wind">Wind</option><option value="marine">Marine</option><option value="other">Other</option>
          </select>
          <button onClick={addComponent} className={btnPrimary}><Plus size={18} /> Add Component</button>
        </Panel>
      </div>

      <Panel title="Components, Targets & Working Days" dot="bg-violet-500">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="text-left text-slate-400 text-[11px] font-bold uppercase tracking-wide border-b-2 border-slate-200">
              <th className="py-2.5 px-2.5">Component</th><th className="py-2.5 px-2.5">Industry</th>
              <th className="py-2.5 px-2.5 text-right">Monthly Target</th><th className="py-2.5 px-2.5 text-right">Working Days</th>
              <th className="py-2.5 px-2.5 text-right">Daily</th><th className="py-2.5 px-2.5 text-right">Per Shift</th><th className="py-2.5 px-2.5 w-10" />
            </tr></thead>
            <tbody>
              {components.map((c) => {
                const p = planFor(c.id); const target = p?.target_qty ?? 0; const wd = p?.working_days ?? 26; const daily = target / wd;
                return (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="py-3 px-2.5 font-semibold text-sm">{c.name}{c.code && <span className="text-slate-400 font-normal"> · {c.code}</span>}</td>
                    <td className="py-3 px-2.5 text-sm text-slate-500 capitalize">{c.industry || "—"}</td>
                    <td className="py-3 px-2.5 text-right"><input type="number" min="0" defaultValue={target} onBlur={(e) => changeTarget(c.id, e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={cellCls} /></td>
                    <td className="py-3 px-2.5 text-right"><input type="number" min="1" defaultValue={wd} onBlur={(e) => changeWD(c.id, e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={cellCls} /></td>
                    <td className="py-3 px-2.5 text-right font-bold text-amber-600">{daily.toFixed(1)}</td>
                    <td className="py-3 px-2.5 text-right text-slate-500">{(daily / 3).toFixed(1)}</td>
                    <td className="py-3 px-2.5"><button onClick={() => removeComponent(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-500 transition"><Trash2 size={15} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={`${hintCls} mt-3`}>Edit a target or working days and click away (or press Enter) to save. Removing a component hides it but keeps its production history intact.</div>
      </Panel>
    </>
  );
}

/* ------------------------------ UI bits ----------------------------------- */
const inputCls = "w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 text-base font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition";
const cellCls = "w-20 px-2.5 py-1.5 text-right bg-slate-50 border-2 border-slate-200 rounded-lg font-semibold text-slate-700 focus:border-indigo-500 outline-none";
const labelCls = "block text-slate-500 text-sm font-semibold mb-1.5";
const btnPrimary = "w-full py-3.5 rounded-2xl bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition shadow-md";
const hintCls = "text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2.5 leading-relaxed";
const warnCls = "flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2.5 rounded-xl leading-snug";

function Kpi({ title, value, unit, Icon, color, soft, foot, footColor }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex gap-3.5 items-center">
      <div className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 ${soft}`}><Icon size={20} className={color} /></div>
      <div className="min-w-0">
        <div className="text-slate-500 text-xs font-semibold mb-0.5 truncate">{title}</div>
        <div className="flex items-baseline gap-1"><span className="text-2xl font-extrabold leading-none">{value}</span>{unit && <span className="text-slate-400 text-xs">{unit}</span>}</div>
        {foot && <div className={`text-[11px] font-semibold mt-1 ${footColor || "text-slate-400"}`}>{foot}</div>}
      </div>
    </div>
  );
}
const Panel = ({ title, dot, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
    <div className="flex items-center gap-2.5 mb-4"><span className={`w-2.5 h-2.5 rounded-sm ${dot}`} /><span className="font-bold text-[15px]">{title}</span></div>
    {children}
  </div>
);
const PageHead = ({ title, sub }) => (<div className="mb-5"><h1 className="text-2xl font-extrabold">{title}</h1><div className="text-slate-500 text-sm">{sub}</div></div>);
const Empty = ({ msg }) => <div className="text-slate-400 text-sm text-center py-6">{msg}</div>;

const Fonts = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    input[type=number]::-webkit-inner-spin-button { opacity: .4; }
    ::-webkit-scrollbar { width: 9px; height: 9px; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 5px; }
  `}</style>
);
