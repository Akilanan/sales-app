// ============================================================================
// src/lib/supabaseClient.js
// Drop-in replacement for the MVP's local `db`. Exposes the IDENTICAL method
// names + signatures, so the UI does not change. It also exports a no-op
// `seedIfEmpty` so the App's `await seedIfEmpty()` call keeps working as-is.
//
// To swap into the MVP (prana-production-mvp.jsx):
//   1. Delete the local data-layer block: the `mem`/`store` shim,
//      `seedIfEmpty`, and the `const db = { ... }` object.
//   2. Add at the top of the file:
//          import { db, seedIfEmpty } from "./lib/supabaseClient";
//   Everything else (App + all screens) stays exactly the same.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

// Vite env vars (rename to NEXT_PUBLIC_* if you use Next.js).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The operator PIN secret NO LONGER ships in the bundle. loginByPin() POSTs the
// PIN to the `operator-login` Edge Function, which holds OPERATOR_SECRET as a
// server secret, signs the operator in, and returns the session. See
// supabase/functions/operator-login. (Set the OPERATOR_SECRET function secret to
// the same value the seed uses.)

const CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
// `supabase` is null in local demo mode; db methods below are simply not called then.
export const supabase = CONFIGURED ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// --- internal helpers -------------------------------------------------------
const userToEmail = (u) =>
  String(u).includes("@") ? String(u).trim() : `${String(u).trim()}@prana.app`;
const toMs = (t) => (t ? Date.parse(t) : Date.now()); // UI sorts created_at numerically
function monthRange(m /* 'YYYY-MM' */) {
  const [y, mo] = m.split("-").map(Number);
  const next = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
  return { start: `${m}-01`, next };
}
async function profileOf(authId) {
  const { data } = await supabase.from("users").select("*").eq("id", authId).single();
  return data || null;
}

// Data now lives in Supabase and is seeded separately — keep this a no-op so
// the MVP's startup call resolves without changing the UI.
export async function seedIfEmpty() {}

export const db = {
  // ---- AUTH ----------------------------------------------------------------
  async loginByPin(pin) {
    // The PIN goes to the operator-login Edge Function (which holds the secret
    // server-side and returns a session) — the secret never ships in the bundle.
    const { data, error } = await supabase.functions.invoke("operator-login", {
      body: { pin: String(pin).trim() },
    });
    if (error || !data?.access_token || !data?.refresh_token) return null;
    const { error: sErr } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (sErr) return null;
    const { data: { user } } = await supabase.auth.getUser();
    const p = user ? await profileOf(user.id) : null;
    if (p && p.role === "operator" && p.active) return p;
    await supabase.auth.signOut({ scope: "local" }); // reject → clear ONLY this client's half-set session; never revoke the user's other devices (default scope is global)
    return null;
  },

  async loginByCredentials(username, password) {
    // The MVP's "Username" field accepts a bare name (e.g. "anita") or a full
    // email. Bare names are mapped to <name>@prana.app.
    const { data, error } = await supabase.auth.signInWithPassword({
      email: userToEmail(username),
      password,
    });
    if (error || !data?.user) return null;
    const p = await profileOf(data.user.id);
    if (p && (p.role === "supervisor" || p.role === "admin") && p.active) return p;
    await supabase.auth.signOut({ scope: "local" }); // not an active manager → clear ONLY this client's session (never the user's other devices)
    return null;
  },

  // Re-establish the UI session from a persisted token on boot (page reload),
  // re-gating by role + active. Returns the profile, or null (and signs out) if
  // the session is stale / the user was deactivated. Fixes "reload → login".
  async restoreSession() {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data: { user } } = await supabase.auth.getUser();
    const p = user ? await profileOf(user.id) : null;
    if (p && p.active && (p.role === "operator" || p.role === "supervisor" || p.role === "admin")) return p;
    await supabase.auth.signOut({ scope: "local" }); // stale/deactivated token → clear locally only; deactivation revokes server-side via revoke_user_sessions()
    return null;
  },

  // Subscribe to auth lifecycle so the UI can drop a user on SIGNED_OUT (token
  // revoked by a deactivation, or expired). Returns an unsubscribe fn. No-op in demo.
  onAuthStateChange(cb) {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((event) => cb(event));
    return () => { try { data.subscription.unsubscribe(); } catch { /* ignore */ } };
  },

  // ---- COMPONENTS ----------------------------------------------------------
  async listComponents() {
    const { data, error } = await supabase
      .from("components").select("*").eq("active", true).order("name");
    if (error) throw error;
    return data;
  },
  async addComponent({ code, name, industry }) {
    const { data, error } = await supabase
      .from("components")
      .insert({ code: code || null, name, industry: industry || null })
      .select().single();
    if (error) throw error;
    return data;
  },
  async deactivateComponent(id) {
    const { error } = await supabase.from("components").update({ active: false }).eq("id", id);
    if (error) throw error;
  },
  async setComponentRate(id, rate) {
    const { error } = await supabase.from("components").update({ rate: Number(rate) || 0 }).eq("id", id);
    if (error) throw error;
  },
  // Edit name/code/industry after creation, or restore (active: true) a removed part.
  async updateComponent(id, fields) {
    const { error } = await supabase.from("components").update(fields).eq("id", id);
    if (error) throw error;
  },
  // Including inactive — for the "Show removed" restore list only.
  async listComponentsAll() {
    const { data, error } = await supabase.from("components").select("*").order("name");
    if (error) throw error;
    return data;
  },

  // ---- SETTINGS + machine capacity (editable) -------------------------------
  async getSettings() {
    const { data, error } = await supabase.from("app_settings").select("*");
    if (error) throw error;
    return Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  },
  async setSetting(key, value) {
    const { error } = await supabase.from("app_settings").upsert({ key, value: String(value) });
    if (error) throw error;
  },
  async setMachine(id, fields) {
    const { error } = await supabase.from("machines").update(fields).eq("id", id);
    if (error) throw error;
  },

  // ---- OPERATIONS (routing — Phase 1 of the planning module) ----------------
  async listOperations() {
    const { data, error } = await supabase
      .from("component_operations").select("*").eq("active", true)
      .order("component_id").order("op_no");
    if (error) throw error;
    return data;
  },
  async addOperation({ component_id, op_no, description, cycle_time, setup_time, insertion_time }) {
    const { data, error } = await supabase.from("component_operations").insert({
      component_id, op_no, description: description || null,
      cycle_time: cycle_time || 0, setup_time: setup_time || 0,
      insertion_time: insertion_time ?? 60,
    }).select().single();
    if (error) throw error;
    return data;
  },
  async updateOperation(id, fields) {
    const { error } = await supabase.from("component_operations").update(fields).eq("id", id);
    if (error) throw error;
  },
  async removeOperation(id) {
    const { error } = await supabase.from("component_operations").delete().eq("id", id);
    if (error) throw error;
  },

  // ---- MACHINE PLAN LINES (Phase 2: per-machine monthly loading) -------------
  async listMachinePlanLines(month) {
    const { data, error } = await supabase
      .from("machine_plan_lines").select("*").eq("month", `${month}-01`).eq("active", true)
      .order("machine_id").order("seq");
    if (error) throw error;
    return data;
  },
  async addMachinePlanLine({ month, machine_id, component_id, qty, seq }) {
    const { data, error } = await supabase.from("machine_plan_lines").insert({
      month: `${month}-01`, machine_id, component_id, qty: qty || 0, seq: seq || 0,
    }).select().single();
    if (error) throw error;
    return data;
  },
  async updateMachinePlanLine(id, fields) {
    const { error } = await supabase.from("machine_plan_lines").update(fields).eq("id", id);
    if (error) throw error;
  },
  async removeMachinePlanLine(id) {
    const { error } = await supabase.from("machine_plan_lines").delete().eq("id", id);
    if (error) throw error;
  },

  // ---- MACHINES ------------------------------------------------------------
  async listMachines() {
    const { data, error } = await supabase
      .from("machines").select("*").eq("active", true).order("code");
    if (error) throw error;
    return data;
  },
  async listMachinesAll() {
    const { data, error } = await supabase.from("machines").select("*").order("code");
    if (error) throw error;
    return data;
  },
  async addMachine({ code, name, shifts = 3, working_days = 24 }) {
    const { data, error } = await supabase.from("machines")
      .insert({ code, name: name || code, shifts, working_days })
      .select().single();
    if (error) {
      if (error.code === "23505") throw new Error("A machine with this code already exists.");
      throw error;
    }
    return data;
  },

  // ---- MONTHLY PLAN --------------------------------------------------------
  async getPlans(month /* 'YYYY-MM' */) {
    const { data, error } = await supabase
      .from("monthly_plans").select("*").eq("month", `${month}-01`);
    if (error) throw error;
    return data;
  },
  async upsertPlan({ month, component_id, target_qty, working_days }) {
    const { error } = await supabase
      .from("monthly_plans")
      .upsert(
        { month: `${month}-01`, component_id, target_qty, working_days },
        { onConflict: "month,component_id" }
      );
    if (error) throw error;
  },

  // ---- PRODUCTION ENTRIES --------------------------------------------------
  async addEntry(entry) {
    // entry = { production_date, shift, component_id, machine_id, operator_id, quantity, scrap_qty, notes }
    const { data, error } = await supabase
      .from("production_entries").insert(entry).select().single();
    if (error) {
      // 23505 = unique_violation from the (date,shift,component,operator) guard.
      if (error.code === "23505") {
        throw new Error("An entry for this operator, component, shift and date already exists.");
      }
      throw error;
    }
    return { ...data, created_at: toMs(data.created_at) };
  },
  async listEntries({ month } = {}) {
    let q = supabase.from("production_entries").select("*");
    if (month) {
      const { start, next } = monthRange(month);
      q = q.gte("production_date", start).lt("production_date", next);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data.map((e) => ({ ...e, created_at: toMs(e.created_at) }));
  },
  async removeEntry(id) {
    const { error } = await supabase.from("production_entries").delete().eq("id", id);
    if (error) throw error;
  },
  // Correct a saved entry (managers; RLS entries_update_managers). The existing
  // audit trigger logs the before-image automatically.
  async updateEntry(id, fields) {
    const { data, error } = await supabase
      .from("production_entries").update(fields).eq("id", id).select().single();
    if (error) throw error;
    return { ...data, created_at: toMs(data.created_at) };
  },
  // id→name map for showing WHO logged each entry. RLS scopes it naturally:
  // managers see everyone (users_select_managers), operators see only themselves.
  async listUsersLite() {
    const { data, error } = await supabase.from("users").select("id, name");
    if (error) return [];
    return data || [];
  },

  // ---- extras (not used by the current UI; ready for Phase 2) --------------
  async listAuditTrail() {
    const { data, error } = await supabase
      .from("entry_audit").select("*").order("changed_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  // ---- REALTIME ------------------------------------------------------------
  // Live cross-device sync. Calls `onChange` whenever production_entries,
  // monthly_plans, or components change in Postgres — RLS still filters which
  // rows each client receives (operators: own entries; managers: all), and the
  // subsequent reload is RLS-scoped too, so nobody ever sees data they shouldn't.
  // `onStatus(connected)` reports the live state for a UI indicator. Returns an
  // unsubscribe function. No-op in local/demo mode.
  subscribe(onChange, onStatus) {
    if (!supabase) return () => {};
    const channel = supabase
      .channel("prana-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "production_entries" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "monthly_plans" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "components" }, onChange)
      .subscribe((status) => { if (onStatus) onStatus(status === "SUBSCRIBED"); });
    return () => { supabase.removeChannel(channel); };
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  // ---- ADMIN: team management (admin-only, via the admin-users Edge Function) -
  // functions.invoke automatically attaches the signed-in admin's JWT as the
  // Authorization header; the function re-verifies admin role server-side before
  // touching anything. The privileged key lives only in the function's secrets.
  async adminListUsers() {
    const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "list" } });
    if (error) throw new Error((await readFnError(error)) || "Failed to load team");
    return data?.users || [];
  },
  async adminCreateOperator(name) {
    const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "createOperator", name } });
    if (error) throw new Error((await readFnError(error)) || "Failed to add operator");
    return data?.operator; // { name, pin }
  },
  async adminCreateManager({ name, username, role }) {
    const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "createManager", name, username, role } });
    if (error) throw new Error((await readFnError(error)) || "Failed to add manager");
    return data?.manager; // { name, username, role, password }
  },
  async adminSetActive(id, active) {
    const { error } = await supabase.functions.invoke("admin-users", { body: { action: "setActive", id, active } });
    if (error) throw new Error((await readFnError(error)) || "Failed to update");
    return true;
  },
  async adminResetPassword(id) {
    const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "resetPassword", id } });
    if (error) throw new Error((await readFnError(error)) || "Failed to reset password");
    return data?.manager; // { name, username, password }
  },
  async adminRegeneratePin(id) {
    const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "regeneratePin", id } });
    if (error) throw new Error((await readFnError(error)) || "Failed to regenerate PIN");
    return data?.operator; // { name, pin }
  },
};

// supabase.functions.invoke wraps non-2xx responses in a FunctionsHttpError whose
// real message sits in error.context (a Response). Pull it out for a useful toast.
async function readFnError(error) {
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.json === "function") { const j = await ctx.json(); return j?.error; }
  } catch { /* ignore */ }
  return error?.message;
}
