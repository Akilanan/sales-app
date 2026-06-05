// src/lib/localDb.js
// In-browser demo data layer. No backend required — persists to localStorage so
// you can try the full app instantly. Exposes the SAME interface as
// supabaseClient's `db`, including a matching duplicate guard, so behaviour
// lines up with production.

const SHIFTS = [1, 2, 3];
const todayStr = () => new Date().toISOString().slice(0, 10);
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
    const seed = [
      { code: "CP-100", name: "Clamping Plate", industry: "railway", target: 200, wd: 26 },
      { code: "WHF-22", name: "Wind Hub Flange", industry: "wind", target: 120, wd: 26 },
      { code: "MC-07", name: "Marine Coupling", industry: "marine", target: 80, wd: 26 },
      { code: "RAB-15", name: "Rail Axle Bush", industry: "railway", target: 300, wd: 26 },
      { code: "WBR-09", name: "Wind Brake Disc", industry: "wind", target: 150, wd: 26 },
    ];
    const components = seed.map((c) => ({ id: uid(), code: c.code, name: c.name, industry: c.industry, active: true }));
    const month = monthToDate(curMonth());
    const monthly_plans = components.map((c, i) => ({ id: uid(), month, component_id: c.id, target_qty: seed[i].target, working_days: seed[i].wd }));

    const operators = users.filter((u) => u.role === "operator");
    const entries = [];
    for (let back = 6; back >= 0; back--) {
      const d = new Date(); d.setDate(d.getDate() - back);
      const ds = d.toISOString().slice(0, 10);
      if (ds.slice(0, 7) !== curMonth()) continue;
      components.forEach((c) => {
        const p = monthly_plans.find((x) => x.component_id === c.id);
        const perShift = (p.target_qty / p.working_days) / 3;
        SHIFTS.forEach((s) => {
          if (ds === todayStr() && s === 3) return;
          entries.push({
            id: uid(), production_date: ds, shift: s, component_id: c.id,
            machine_id: randOf(machines).id, operator_id: randOf(operators).id,
            quantity: Math.max(0, Math.round(perShift * (0.7 + Math.random() * 0.6))),
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
  async signOut() { /* no session in demo mode */ },
};
