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

// Operators sign in with PIN-as-password. To satisfy the min-password-length
// rule and add a little entropy, the real auth password is PIN + this secret.
// IT MUST MATCH the value used by the seed (seed.mjs / seed.sql).
const OPERATOR_SECRET = "prana-operator-v1";

const CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
// `supabase` is null in local demo mode; db methods below are simply not called then.
export const supabase = CONFIGURED ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// --- internal helpers -------------------------------------------------------
const pinToEmail = (pin) => `${String(pin).trim()}@operator.prana.app`;
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email: pinToEmail(pin),
      password: `${String(pin).trim()}${OPERATOR_SECRET}`,
    });
    if (error || !data?.user) return null;
    const p = await profileOf(data.user.id);
    return p && p.role === "operator" && p.active ? p : null;
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
    return p && (p.role === "supervisor" || p.role === "admin") && p.active ? p : null;
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

  // ---- MACHINES ------------------------------------------------------------
  async listMachines() {
    const { data, error } = await supabase
      .from("machines").select("*").eq("active", true).order("code");
    if (error) throw error;
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

  // ---- extras (not used by the current UI; ready for Phase 2) --------------
  async listAuditTrail() {
    const { data, error } = await supabase
      .from("entry_audit").select("*").order("changed_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  async signOut() {
    await supabase.auth.signOut();
  },
};
