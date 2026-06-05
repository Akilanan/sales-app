// ============================================================================
// seed.mjs  ·  Recommended seeding path (creates Auth users reliably).
// Run locally:
//   npm i @supabase/supabase-js
//   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  node seed.mjs
//
// The service-role key bypasses RLS and can create Auth users — keep it SECRET
// and never ship it to the browser.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPERATOR_SECRET = process.env.OPERATOR_SECRET || "prana-operator-v1"; // MUST match supabaseClient.js / VITE_OPERATOR_SECRET

if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const operators = [
  { name: "Ravi Kumar", pin: "1001" },
  { name: "Suresh Patil", pin: "1002" },
  { name: "Lakshmi Devi", pin: "1003" },
];
const managers = [
  { name: "Anita Rao", email: "anita@prana.app", password: "anita123", role: "supervisor" },
  { name: "Admin", email: "admin@prana.app", password: "admin123", role: "admin" },
];
const machines = ["CNC-01", "CNC-02", "CNC-03", "CNC-04"];
const components = [
  { code: "CP-100", name: "Clamping Plate", industry: "railway", target: 200 },
  { code: "WHF-22", name: "Wind Hub Flange", industry: "wind", target: 120 },
  { code: "MC-07", name: "Marine Coupling", industry: "marine", target: 80 },
  { code: "RAB-15", name: "Rail Axle Bush", industry: "railway", target: 300 },
  { code: "WBR-09", name: "Wind Brake Disc", industry: "wind", target: 150 },
];

async function ensureUser(email, password, profile) {
  let { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error && !String(error.message).toLowerCase().includes("already")) throw error;
  let id = data?.user?.id;
  if (!id) {
    // User already existed — find them. perPage bumped past the default 50 so a
    // re-run still finds existing users once you grow beyond one page.
    const list = await admin.auth.admin.listUsers({ perPage: 1000 });
    id = list.data.users.find((u) => u.email === email)?.id;
  }
  if (!id) throw new Error(`Could not create or find auth user ${email}`);
  await admin.from("users").upsert({ id, ...profile });
  return id;
}

async function main() {
  // 1) Auth users + profiles
  const opIds = [];
  for (const o of operators) {
    const id = await ensureUser(`${o.pin}@operator.prana.app`, `${o.pin}${OPERATOR_SECRET}`, {
      name: o.name, role: "operator", login_code: o.pin, active: true,
    });
    opIds.push(id);
  }
  for (const m of managers) {
    await ensureUser(m.email, m.password, { name: m.name, role: m.role, login_code: null, active: true });
  }

  // 2) Reference data
  await admin.from("machines").upsert(machines.map((code) => ({ code, name: code, active: true })), { onConflict: "code" });
  await admin.from("components").upsert(components.map((c) => ({ code: c.code, name: c.name, industry: c.industry, active: true })), { onConflict: "code" });

  const { data: comps } = await admin.from("components").select("id,code");
  const { data: mach } = await admin.from("machines").select("id");

  // 3) Monthly plan for the current month
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const plans = components.map((c) => {
    const comp = comps.find((x) => x.code === c.code);
    if (!comp) throw new Error(`Component ${c.code} missing after upsert — cannot build its monthly plan.`);
    return { month: monthStr, component_id: comp.id, target_qty: c.target, working_days: 26 };
  });
  await admin.from("monthly_plans").upsert(plans, { onConflict: "month,component_id" });

  // 4) ~1 week of production entries (skips tonight's Shift 3)
  const { data: planRows } = await admin
    .from("monthly_plans").select("component_id,target_qty,working_days").eq("month", monthStr);
  const todayISO = now.toISOString().slice(0, 10);
  const entries = [];
  for (let back = 6; back >= 0; back--) {
    const d = new Date(); d.setDate(now.getDate() - back);
    const ds = d.toISOString().slice(0, 10);
    if (ds.slice(0, 7) !== monthStr.slice(0, 7)) continue;
    for (const c of comps) {
      const p = planRows.find((x) => x.component_id === c.id);
      if (!p) continue;
      const perShift = p.target_qty / p.working_days / 3;
      for (const shift of [1, 2, 3]) {
        if (ds === todayISO && shift === 3) continue;
        entries.push({
          production_date: ds,
          shift,
          component_id: c.id,
          machine_id: mach[Math.floor(Math.random() * mach.length)].id,
          operator_id: opIds[Math.floor(Math.random() * opIds.length)],
          quantity: Math.max(0, Math.round(perShift * (0.7 + Math.random() * 0.6))),
          scrap_qty: Math.random() < 0.2 ? 1 : 0,
        });
      }
    }
  }
  await admin
    .from("production_entries")
    .upsert(entries, { onConflict: "production_date,shift,component_id,operator_id", ignoreDuplicates: true });

  console.log(`Seeded ${opIds.length} operators, ${managers.length} managers, ` +
    `${components.length} components, ${machines.length} machines, ${entries.length} entries.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
