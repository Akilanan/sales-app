// ============================================================================
// seed.prod.mjs  ·  PRODUCTION seeding for a REAL company rollout.
//
// Unlike seed.mjs (demo data with weak/known passwords), this script:
//   - reads your real people / machines / components from company.config.json
//   - generates a STRONG, UNIQUE password for every manager (supervisor/admin)
//   - sets up operators with PIN login (real password = PIN + OPERATOR_SECRET)
//   - creates NO fake production entries — you start with a clean slate
//   - writes CREDENTIALS.txt for you to print, hand out, then DELETE
//
// Setup:
//   1) copy company.config.example.json -> company.config.json  and fill it in
//   2) in YOUR terminal (PowerShell), with the FRESH service_role key:
//        $env:SUPABASE_URL = "https://YOUR-REF.supabase.co"
//        $env:SUPABASE_SERVICE_ROLE_KEY = "<fresh service_role key>"
//        $env:OPERATOR_SECRET = "<long random string>"   # MUST match VITE_OPERATOR_SECRET
//        npm run seed:prod
//
// The service-role key bypasses RLS — keep it SECRET, never ship it to the
// browser, never commit it. Re-running regenerates manager passwords.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPERATOR_SECRET = process.env.OPERATOR_SECRET;

if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your terminal first.");
  process.exit(1);
}
if (!OPERATOR_SECRET || OPERATOR_SECRET.length < 12) {
  console.error("Set OPERATOR_SECRET (12+ chars). It MUST equal VITE_OPERATOR_SECRET in your .env / Vercel.");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const configPath = join(here, "company.config.json");
let config;
try {
  config = JSON.parse(readFileSync(configPath, "utf8"));
} catch {
  console.error(`Could not read ${configPath}.`);
  console.error("Copy supabase/company.config.example.json to supabase/company.config.json and fill it in.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Strong password generator. Excludes ambiguous chars (0/O, 1/l/I) so people
// can read them off a printout without confusion.
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%+=";
const strongPassword = (len = 16) =>
  Array.from({ length: len }, () => ALPHA[randomInt(ALPHA.length)]).join("");

const userToEmail = (u) =>
  String(u).includes("@") ? String(u).trim() : `${String(u).trim()}@prana.app`;

async function ensureUser(email, password, profile) {
  let { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  const created = Boolean(data?.user?.id);
  if (error && !String(error.message).toLowerCase().includes("already")) throw error;

  let id = data?.user?.id;
  if (!id) {
    const list = await admin.auth.admin.listUsers({ perPage: 1000 });
    id = list.data.users.find((u) => u.email === email)?.id;
    if (!id) throw new Error(`Could not create or find auth user ${email}`);
    // User already existed — reset the password so it matches what we print.
    await admin.auth.admin.updateUserById(id, { password });
  }
  await admin.from("users").upsert({ id, ...profile });
  return { id, created };
}

async function main() {
  const credentials = [];

  // 1) OPERATORS — PIN login (password = PIN + OPERATOR_SECRET, never printed).
  const pins = new Set();
  for (const o of config.operators || []) {
    const pin = String(o.pin).trim();
    if (!/^\d{3,8}$/.test(pin)) throw new Error(`Operator PIN "${pin}" must be 3-8 digits.`);
    if (pins.has(pin)) throw new Error(`Duplicate operator PIN ${pin} — PINs must be unique.`);
    pins.add(pin);
    await ensureUser(`${pin}@operator.prana.app`, `${pin}${OPERATOR_SECRET}`, {
      name: o.name, role: "operator", login_code: pin, active: true,
    });
    credentials.push(`OPERATOR   ${String(o.name).padEnd(22)} tab: Operator   PIN: ${pin}`);
  }

  // 2) MANAGERS — email + strong unique password.
  for (const m of config.managers || []) {
    const role = m.role === "admin" ? "admin" : "supervisor";
    const password = strongPassword(16);
    await ensureUser(userToEmail(m.username), password, {
      name: m.name, role, login_code: null, active: true,
    });
    credentials.push(
      `${role.toUpperCase().padEnd(10)} ${String(m.name).padEnd(22)} tab: Manager    user: ${m.username}   pass: ${password}`
    );
  }

  // 3) MACHINES — note: there is no in-app screen to add machines yet, so set
  //    them here (and re-run later to add more).
  if (config.machines?.length) {
    await admin.from("machines").upsert(
      config.machines.map((code) => ({ code, name: code, active: true })),
      { onConflict: "code" }
    );
  }

  // 4) COMPONENTS — can also be added later by an admin in the app UI.
  if (config.components?.length) {
    const ok = new Set(["railway", "wind", "marine", "other"]);
    await admin.from("components").upsert(
      config.components.map((c) => ({
        code: c.code,
        name: c.name,
        industry: ok.has(c.industry) ? c.industry : null,
        active: true,
      })),
      { onConflict: "code" }
    );
  }

  // 5) OPTIONAL — set this month's plan/targets so the dashboard isn't empty.
  if (config.setupCurrentMonthPlan && config.components?.length) {
    const { data: comps } = await admin.from("components").select("id,code");
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const plans = config.components
      .filter((c) => c.target)
      .map((c) => ({
        month: monthStr,
        component_id: comps.find((x) => x.code === c.code)?.id,
        target_qty: c.target,
        working_days: c.workingDays || 26,
      }))
      .filter((p) => p.component_id);
    if (plans.length) await admin.from("monthly_plans").upsert(plans, { onConflict: "month,component_id" });
  }

  // Write the credentials sheet (gitignored). PRINT IT, HAND OUT, THEN DELETE.
  const sheet =
    `PRANA VENTURE — login credentials\n` +
    `App: ${config.appUrl || "<your deployed URL>"}\n` +
    `\n` +
    `KEEP THIS PRIVATE. Give each person ONLY their own line, then delete this file.\n` +
    `Operators: "Operator" tab -> enter PIN.   Managers: "Manager" tab -> username + password.\n` +
    `\n` +
    credentials.join("\n") + "\n";
  writeFileSync(join(here, "..", "CREDENTIALS.txt"), sheet, "utf8");

  console.log(
    `Seeded ${(config.operators || []).length} operators, ${(config.managers || []).length} managers, ` +
    `${(config.machines || []).length} machines, ${(config.components || []).length} components.`
  );
  console.log(`Credentials written to CREDENTIALS.txt — print it, hand out logins, then DELETE it.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
