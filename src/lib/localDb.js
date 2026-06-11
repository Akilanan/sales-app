// src/lib/localDb.js
// In-browser demo data layer. No backend required — persists to localStorage so
// you can try the full app instantly. Exposes the SAME interface as
// supabaseClient's `db`, including a matching duplicate guard, so behaviour
// lines up with production.

const SHIFTS = [1, 2, 3];
const todayStr = () => new Date().toLocaleDateString("en-CA"); // LOCAL date — must match App.jsx (not UTC)
const curMonth = () => todayStr().slice(0, 7);
const monthToDate = (m) => `${m}-01`;
const uid = () => Math.random().toString(36).slice(2, 9);
const randOf = (a) => a[Math.floor(Math.random() * a.length)];
const PREFIX = "prana:";

const mem = {};
const store = {
  async read(t) {
    if (t in mem) return mem[t];
    try {
      const raw = localStorage.getItem(PREFIX + t);
      mem[t] = raw ? JSON.parse(raw) : null;
    } catch {
      mem[t] = mem[t] ?? null;
    }
    return mem[t];
  },
  async write(t, rows) {
    mem[t] = rows;
    try {
      localStorage.setItem(PREFIX + t, JSON.stringify(rows));
    } catch {
      /* localStorage unavailable/full — keep in memory for this session */
    }
  },
};

let seedPromise;
export async function seedIfEmpty() {
  if (seedPromise) return seedPromise; // guard against React StrictMode double-run
  seedPromise = (async () => {
    if (await store.read("components")) return;

    const users = [
      { id: uid(), name: "Ravi Kumar", role: "operator", login_code: "1001", username: null, password: null, active: true },
      { id: uid(), name: "Suresh Patil", role: "operator", login_code: "1002", username: null, password: null, active: true },
      { id: uid(), name: "Lakshmi Devi", role: "operator", login_code: "1003", username: null, password: null, active: true },
      { id: uid(), name: "Anita Rao", role: "supervisor", login_code: null, username: "anita", password: "anita123", active: true },
      { id: uid(), name: "Admin", role: "admin", login_code: null, username: "admin", password: "admin123", active: true },
    ];
    const machines = ["CNC-01", "CNC-02", "CNC-03", "CNC-04"].map((code) => ({ id: uid(), code, name: code, active: true }));
    // `perf` = each line's pace vs plan, so the demo board shows a believable
    // spread (one critical line dragging the floor, two behind, two on/ahead) and
    // exercises the whole green/amber/red status system — not a flat amber wall.
    const seed = [
      // perf is calibrated so the board still shows green AFTER today's partial day
      // (shift 3 isn't logged yet, which trims ~5% off every line's pace).
      { code: "CP-100", name: "Clamping Plate", industry: "railway", target: 1240, wd: 24, perf: 0.74 }, // critical — the problem line
      { code: "WHF-22", name: "Wind Hub Flange", industry: "wind", target: 760, wd: 25, perf: 1.16 },   // clearly ahead of pace
      { code: "MC-07", name: "Marine Coupling", industry: "marine", target: 425, wd: 26, perf: 0.90 },  // behind
      { code: "RAB-15", name: "Rail Axle Bush", industry: "railway", target: 980, wd: 24, perf: 1.10 }, // on track
      { code: "WBR-09", name: "Wind Brake Disc", industry: "wind", target: 612, wd: 25, perf: 0.85 },   // behind
    ];
    const components = seed.map((c) => ({ id: uid(), code: c.code, name: c.name, industry: c.industry, active: true }));
    const month = monthToDate(curMonth());
    const monthly_plans = components.map((c, i) => ({ id: uid(), month, component_id: c.id, target_qty: seed[i].target, working_days: seed[i].wd }));
    const perfBy = {};
    components.forEach((c, i) => { perfBy[c.id] = seed[i].perf; });

    const operators = users.filter((u) => u.role === "operator");
    const entries = [];
    for (let back = 6; back >= 0; back--) {
      const d = new Date(); d.setDate(d.getDate() - back);
      const ds = d.toISOString().slice(0, 10);
      if (ds.slice(0, 7) !== curMonth()) continue;
      components.forEach((c) => {
        const p = monthly_plans.find((x) => x.component_id === c.id);
        const perShift = (p.target_qty / p.working_days) / 3;
        const perf = perfBy[c.id] || 1; // line's intended pace
        SHIFTS.forEach((s) => {
          if (ds === todayStr() && s === 3) return;
          entries.push({
            id: uid(), production_date: ds, shift: s, component_id: c.id,
            machine_id: randOf(machines).id, operator_id: randOf(operators).id,
            quantity: Math.max(0, Math.round(perShift * perf * (0.9 + Math.random() * 0.2))),
            scrap_qty: Math.random() < 0.2 ? 1 : 0, notes: "", created_at: Date.now() - back * 86400000,
          });
        });
      });
    }

    await store.write("users", users);
    await store.write("machines", machines);
    await store.write("components", components);
    await store.write("monthly_plans", monthly_plans);
    await store.write("production_entries", entries);
  })();
  return seedPromise;
}

export const db = {
  async loginByPin(pin) {
    const u = (await store.read("users")) || [];
    return u.find((x) => x.role === "operator" && x.login_code === String(pin).trim() && x.active) || null;
  },
  async loginByCredentials(username, password) {
    const u = (await store.read("users")) || [];
    return u.find((x) => (x.role === "supervisor" || x.role === "admin") && x.username === String(username).trim() && x.password === password && x.active) || null;
  },
  async listComponents() {
    return ((await store.read("components")) || []).filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name));
  },
  async addComponent({ code, name, industry }) {
    const rows = (await store.read("components")) || [];
    const row = { id: uid(), code: code || null, name, industry: industry || null, active: true };
    await store.write("components", [...rows, row]);
    return row;
  },
  // ---- OPERATIONS (routing — Phase 1) · demo parity --------------------------
  async listOperations() {
    const ops = (await store.read("component_operations")) || [];
    return ops.filter((o) => o.active !== false).sort((a, b) => (a.component_id + String(a.op_no).padStart(4, "0")).localeCompare(b.component_id + String(b.op_no).padStart(4, "0")));
  },
  async addOperation({ component_id, op_no, description, cycle_time, setup_time, insertion_time }) {
    const ops = (await store.read("component_operations")) || [];
    if (ops.some((o) => o.component_id === component_id && Number(o.op_no) === Number(op_no) && o.active !== false))
      throw new Error(`Operation ${op_no} already exists for this part`);
    const row = { id: uid(), component_id, op_no: Number(op_no), description: description || null, cycle_time: Number(cycle_time) || 0, setup_time: Number(setup_time) || 0, insertion_time: insertion_time ?? 60, active: true, created_at: new Date().toISOString() };
    ops.push(row); await store.write("component_operations", ops);
    return row;
  },
  async updateOperation(id, fields) {
    const ops = (await store.read("component_operations")) || [];
    const o = ops.find((x) => x.id === id);
    if (o) { Object.assign(o, fields); await store.write("component_operations", ops); }
  },
  async removeOperation(id) {
    let ops = (await store.read("component_operations")) || [];
    ops = ops.filter((o) => o.id !== id); await store.write("component_operations", ops);
  },

  // ---- MACHINE PLAN LINES (Phase 2) · demo parity ----------------------------
  async listMachinePlanLines(month) {
    const rows = (await store.read("machine_plan_lines")) || [];
    return rows.filter((r) => r.active !== false && r.month === `${month}-01`).sort((a, b) => (a.machine_id + String(a.seq).padStart(4, "0")).localeCompare(b.machine_id + String(b.seq).padStart(4, "0")));
  },
  async addMachinePlanLine({ month, machine_id, component_id, qty, seq }) {
    const rows = (await store.read("machine_plan_lines")) || [];
    const row = { id: uid(), month: `${month}-01`, machine_id, component_id, qty: Number(qty) || 0, seq: Number(seq) || 0, active: true, created_at: new Date().toISOString() };
    rows.push(row); await store.write("machine_plan_lines", rows);
    return row;
  },
  async updateMachinePlanLine(id, fields) {
    const rows = (await store.read("machine_plan_lines")) || [];
    const r = rows.find((x) => x.id === id);
    if (r) { Object.assign(r, fields); await store.write("machine_plan_lines", rows); }
  },
  async removeMachinePlanLine(id) {
    let rows = (await store.read("machine_plan_lines")) || [];
    rows = rows.filter((r) => r.id !== id); await store.write("machine_plan_lines", rows);
  },

  async deactivateComponent(id) {
    const rows = (await store.read("components")) || [];
    await store.write("components", rows.map((c) => (c.id === id ? { ...c, active: false } : c)));
  },
  async listMachines() {
    return ((await store.read("machines")) || []).filter((m) => m.active);
  },
  async getPlans(month) {
    return ((await store.read("monthly_plans")) || []).filter((p) => p.month.slice(0, 7) === month);
  },
  async upsertPlan({ month, component_id, target_qty, working_days }) {
    const rows = (await store.read("monthly_plans")) || [];
    const m = monthToDate(month);
    const i = rows.findIndex((p) => p.month === m && p.component_id === component_id);
    if (i >= 0) rows[i] = { ...rows[i], target_qty, working_days };
    else rows.push({ id: uid(), month: m, component_id, target_qty, working_days });
    await store.write("monthly_plans", [...rows]);
  },
  async addEntry(entry) {
    const rows = (await store.read("production_entries")) || [];
    // mirror the production unique guard (operator/component/shift/date)
    const dup = rows.find((e) =>
      e.production_date === entry.production_date && e.shift === entry.shift &&
      e.component_id === entry.component_id && e.operator_id === entry.operator_id);
    if (dup) throw new Error("An entry for this operator, component, shift and date already exists.");
    const row = { id: uid(), created_at: Date.now(), scrap_qty: 0, notes: "", ...entry };
    await store.write("production_entries", [...rows, row]);
    return row;
  },
  async listEntries({ month } = {}) {
    let rows = (await store.read("production_entries")) || [];
    if (month) rows = rows.filter((e) => e.production_date.slice(0, 7) === month);
    return rows;
  },
  async removeEntry(id) {
    const rows = (await store.read("production_entries")) || [];
    await store.write("production_entries", rows.filter((e) => e.id !== id));
  },
  async listAuditTrail() { return []; },      // demo: no server-side audit
  subscribe() { return () => {}; },           // demo: single-device, no live sync
  async signOut() { /* no session in demo mode */ },

  // ---- ADMIN: team management (demo parity with the Edge Function) ----------
  async adminListUsers() {
    const u = (await store.read("users")) || [];
    return u.map(({ id, name, role, login_code, active, created_at }) => ({ id, name, role, login_code, active, created_at }))
      .sort((a, b) => (a.role + a.name).localeCompare(b.role + b.name));
  },
  async adminCreateOperator(name) {
    name = String(name || "").trim();
    if (name.length < 2) throw new Error("Name is required");
    const users = (await store.read("users")) || [];
    const taken = new Set(users.map((x) => String(x.login_code || "")));
    let pin = "";
    for (let i = 0; i < 200; i++) { const c = String(1000 + Math.floor(Math.random() * 9000)); if (!taken.has(c)) { pin = c; break; } }
    if (!pin) throw new Error("Could not allocate a free PIN");
    users.push({ id: uid(), name, role: "operator", login_code: pin, username: null, password: null, active: true });
    await store.write("users", users);
    return { name, pin };
  },
  async adminCreateManager({ name, username, role }) {
    name = String(name || "").trim();
    username = String(username || "").trim().toLowerCase();
    role = role === "admin" ? "admin" : "supervisor";
    if (name.length < 2) throw new Error("Name is required");
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error("Username must be 3-32 chars: lowercase letters, digits, . _ -");
    const users = (await store.read("users")) || [];
    if (users.some((x) => x.username === username)) throw new Error("That username is already taken");
    const password = "demo-" + Math.random().toString(36).slice(2, 8);
    users.push({ id: uid(), name, role, login_code: null, username, password, active: true });
    await store.write("users", users);
    return { name, username, role, password };
  },
  async adminSetActive(id, active) {
    const users = (await store.read("users")) || [];
    const u = users.find((x) => x.id === id);
    if (u) { u.active = Boolean(active); await store.write("users", users); }
    return true;
  },
};
