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

// Bump when the seed data changes shape — existing browsers wipe + reseed so
// nobody is left looking at the previous (fake) factory.
const SEED_VERSION = "2-real-factory";
const SEED_TABLES = [
  "users", "machines", "components", "monthly_plans", "production_entries",
  "component_operations", "machine_plan_lines", "app_settings",
];

let seedPromise;
export async function seedIfEmpty() {
  if (seedPromise) return seedPromise; // guard against React StrictMode double-run
  seedPromise = (async () => {
    const haveData = await store.read("components");
    const ver = await store.read("seed_version");
    if (haveData && ver === SEED_VERSION) return;
    for (const t of SEED_TABLES) await store.write(t, null); // stale demo → full reseed

    // People are DEMO-ONLY (the Excel has no names/PINs — real people come from
    // Akilan via Team admin). Everything below them is the REAL factory from his
    // HMC&VMC Excel sheets, mirroring the live Supabase seed.
    const users = [
      { id: uid(), name: "Ravi Kumar", role: "operator", login_code: "1001", username: null, password: null, active: true },
      { id: uid(), name: "Suresh Patil", role: "operator", login_code: "1002", username: null, password: null, active: true },
      { id: uid(), name: "Lakshmi Devi", role: "operator", login_code: "1003", username: null, password: null, active: true },
      { id: uid(), name: "Anita Rao", role: "supervisor", login_code: null, username: "anita", password: "anita123", active: true },
      { id: uid(), name: "Admin", role: "admin", login_code: null, username: "admin", password: "admin123", active: true },
    ];

    // The 15 real machines (Excel Sheet1 machine master), incl. per-machine shifts.
    const MACHINE_DEFS = [
      ["A81", 3], ["CWK 630", 2], ["CWK 800", 3], ["Toyoda800", 3], ["Toyoda 1000", 3],
      ["Toyoda S55-1", 1], ["Toyoda S55-2", 2], ["Toyoda630-1", 3], ["Toyoda630-2", 3],
      ["DMG MORI-1", 3], ["DMG MORI-2", 3], ["MCB-1 HMC-12", 3], ["MCB-2 HMC-13", 3],
      ["VMC-1", 3], ["VMC-2", 3],
    ];
    const machines = MACHINE_DEFS.map(([code, shifts]) => ({ id: uid(), code, name: code, shifts, working_days: 24, active: true }));
    const machineBy = {};
    machines.forEach((m) => { machineBy[m.code] = m; });

    // The 8 real parts + June plan targets (Akilan's 2026-06-11 ruling: June-file
    // plan values; 5713 = 75 per his Sheet1 note). `perf` = demo pace vs plan so
    // the board shows a believable green/amber/critical spread.
    const seed = [
      { code: "1159",  name: "Bearing Casing 1159",          target: 224, perf: 0.92 }, // slightly behind
      { code: "5712",  name: "Clamping Plate DE 5712",       target: 50,  perf: 1.12 }, // ahead
      { code: "5713",  name: "Clamping Plate DE 5713",       target: 75,  perf: 0.74 }, // critical line
      { code: "E191",  name: "E191 Cover",                   target: 24,  perf: 1.04 }, // on track
      { code: "SPX",   name: "SPX Flow (Dev)",               target: 5,   perf: 0 },
      { code: "5048A", name: "5048A Housing Cover (Dev)",    target: 4,   perf: 0 },
      { code: "4797",  name: "Largest Shield 4797 (Rabwin)", target: 1,   perf: 0 },
      { code: "4798",  name: "Bearing Shield 4798 (Rabwin)", target: 1,   perf: 0 },
    ];
    const components = seed.map((c) => ({ id: uid(), code: c.code, name: c.name, industry: null, rate: 0, active: true }));
    const compBy = {};
    components.forEach((c) => { compBy[c.code] = c; });
    const month = monthToDate(curMonth());
    const monthly_plans = components.map((c, i) => ({ id: uid(), month, component_id: c.id, target_qty: seed[i].target, working_days: 24 }));
    const perfBy = {};
    components.forEach((c, i) => { perfBy[c.id] = seed[i].perf; });

    // Real routings (op no, cycle sec/pc, setup min) from the June+May workbooks.
    const OP_DEFS = [
      ["1159", 40, 28, 56], ["1159", 50, 38, 76], ["1159", 60, 6, 12], ["1159", 70, 6, 12],
      ["5712", 40, 120, 480], ["5713", 40, 103, 480], ["E191", 40, 60, 480],
      ["4797", 30, 93, 1330], ["4797", 40, 61, 730], ["4798", 30, 126, 1300], ["4798", 40, 52, 680],
      ["5048A", 20, 60, 180], ["5048A", 30, 50, 150], ["5048A", 40, 30, 90],
      ["SPX", 20, 130, 800],
    ];
    const component_operations = OP_DEFS.map(([code, op_no, cy, su]) => ({
      id: uid(), component_id: compBy[code].id, op_no, description: null,
      cycle_time: cy, setup_time: su, insertion_time: 60, active: true, created_at: new Date().toISOString(),
    }));

    // Machine loading mirroring the June tabs: VMC-1 carries the VMC-01 parts,
    // A81 the a51 HMC-01 parts — so Loading/Gantt/costing demo with real shapes.
    const PLAN_DEFS = [
      ["VMC-1", "5712", 50], ["VMC-1", "5713", 75], ["VMC-1", "E191", 24],
      ["A81", "1159", 224], ["A81", "4797", 1], ["A81", "4798", 1],
    ];
    const machine_plan_lines = PLAN_DEFS.map(([mc, cc, qty], i) => ({
      id: uid(), month, machine_id: machineBy[mc].id, component_id: compBy[cc].id,
      qty, seq: i + 1, active: true, created_at: new Date().toISOString(),
    }));

    const operators = users.filter((u) => u.role === "operator");
    const entries = [];
    for (let back = 6; back >= 0; back--) {
      const d = new Date(); d.setDate(d.getDate() - back);
      const ds = d.toISOString().slice(0, 10);
      if (ds.slice(0, 7) !== curMonth()) continue;
      components.forEach((c) => {
        const p = monthly_plans.find((x) => x.component_id === c.id);
        const perShift = (p.target_qty / p.working_days) / 3;
        const perf = perfBy[c.id] || 0; // line's intended pace (0 = low-volume dev part)
        if (perShift * perf < 0.15) return; // dev parts get hand-placed entries below
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
    // Low-volume dev/Rabwin parts: a couple of real-feeling single entries.
    const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString("en-CA"); };
    if (daysAgo(3).slice(0, 7) === curMonth()) {
      entries.push(
        { id: uid(), production_date: daysAgo(3), shift: 1, component_id: compBy["4797"].id, machine_id: machineBy["A81"].id, operator_id: operators[0].id, quantity: 1, scrap_qty: 0, notes: "", created_at: Date.now() - 3 * 86400000 },
        { id: uid(), production_date: daysAgo(2), shift: 2, component_id: compBy["SPX"].id, machine_id: machineBy["VMC-2"].id, operator_id: operators[1].id, quantity: 2, scrap_qty: 0, notes: "", created_at: Date.now() - 2 * 86400000 },
        { id: uid(), production_date: daysAgo(1), shift: 1, component_id: compBy["5048A"].id, machine_id: machineBy["VMC-2"].id, operator_id: operators[2].id, quantity: 1, scrap_qty: 0, notes: "", created_at: Date.now() - 1 * 86400000 },
      );
    }

    await store.write("users", users);
    await store.write("machines", machines);
    await store.write("components", components);
    await store.write("monthly_plans", monthly_plans);
    await store.write("component_operations", component_operations);
    await store.write("machine_plan_lines", machine_plan_lines);
    await store.write("production_entries", entries);
    await store.write("seed_version", SEED_VERSION);
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
  async setComponentRate(id, rate) {
    const comps = (await store.read("components")) || [];
    const c = comps.find((x) => x.id === id);
    if (c) { c.rate = Number(rate) || 0; await store.write("components", comps); }
  },

  // ---- SETTINGS + machine capacity (editable) · demo parity ------------------
  async getSettings() {
    const s = (await store.read("app_settings")) || {};
    return { target_hr: "2200", machine_rate: "1200", ...s };
  },
  async setSetting(key, value) {
    const s = (await store.read("app_settings")) || {};
    s[key] = String(value); await store.write("app_settings", s);
  },
  async setMachine(id, fields) {
    const ms = (await store.read("machines")) || [];
    const m = ms.find((x) => x.id === id);
    if (m) { Object.assign(m, fields); await store.write("machines", ms); }
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
