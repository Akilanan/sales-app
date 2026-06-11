// ============================================================================
// admin-users  ·  Supabase Edge Function  ·  in-app team management
//
// Lets an ADMIN (and only an admin) create / deactivate operators & managers
// from inside the app, without the privileged key ever touching the browser.
//
// Security model (verify_jwt OFF at the gateway; ALL auth enforced here):
//   1. The browser calls this with the publishable key as `apikey` and the
//      logged-in user's session JWT as `Authorization: Bearer <token>`.
//   2. We cryptographically validate that token via auth.getUser(token).
//   3. We confirm that user's profile is role='admin' AND active=true.
//   Only then do we use the SECRET key to create/modify auth users.
//   A forged/absent token -> 401. A valid non-admin -> 403.
//
// Secret key: read from the platform-provided SUPABASE_SECRET_KEYS (a JSON dict
// of the project's sb_secret_ keys, keyed by name) — no manual secret needed.
// (Custom function secrets can't use the reserved SUPABASE_ prefix; ADMIN_SECRET_KEY
//  and the legacy service_role var are fallbacks.)
// Function secret still required:
//   OPERATOR_SECRET - same value the operators were seeded with (PIN->password).
//   SUPABASE_URL is injected by the platform.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

function getSecretKey(): string | null {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const d = JSON.parse(raw);
      return d["default"] || (Object.values(d)[0] as string) || null;
    } catch { /* not JSON — fall through */ }
  }
  return Deno.env.get("ADMIN_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || null;
}

// CORS locked to the production origin (overridable via ALLOWED_ORIGINS).
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ||
  "https://prana-production-app.12akilan2007.workers.dev")
  .split(",").map((s) => s.trim()).filter(Boolean);
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Unbiased integer in [0, maxExclusive) from the CSPRNG (rejection sampling).
function randInt(maxExclusive: number): number {
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  let x: number;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
  return x % maxExclusive;
}

// Strong password — excludes ambiguous chars (0/O, 1/l/I) for readable printouts.
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%+=";
const strongPassword = (len = 14) =>
  Array.from({ length: len }, () => ALPHA[randInt(ALPHA.length)]).join("");

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const secret = getSecretKey();
  const operatorSecret = Deno.env.get("OPERATOR_SECRET");
  if (!url || !secret || !operatorSecret) return json({ error: "Server not configured" }, 500);

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- 1. authenticate the caller from their Bearer token --------------------
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Not signed in" }, 401);

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

  // ---- 2. authorize: caller must be an active admin --------------------------
  const { data: me } = await admin
    .from("users").select("role, active").eq("id", userData.user.id).single();
  if (!me || me.role !== "admin" || me.active !== true) {
    return json({ error: "Admins only" }, 403);
  }

  // ---- 3. dispatch -----------------------------------------------------------
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const action = String(body?.action || "");

  try {
    if (action === "list") {
      const { data, error } = await admin
        .from("users").select("id, name, role, login_code, active, created_at")
        .order("role").order("name");
      if (error) throw error;
      return json({ users: data }, 200);
    }

    if (action === "createOperator") {
      const name = String(body?.name || "").trim();
      if (name.length < 2) return json({ error: "Name is required" }, 400);

      // unique 6-digit PIN from the CSPRNG (100000-999999 = 900k space, vs the
      // old 4-digit 9k that was brute-forceable; avoid existing login_codes).
      const { data: existing } = await admin.from("users").select("login_code");
      const taken = new Set((existing || []).map((r: any) => String(r.login_code || "")));
      let pin = "";
      for (let i = 0; i < 200; i++) {
        const cand = String(100000 + randInt(900000)); // 100000-999999
        if (!taken.has(cand)) { pin = cand; break; }
      }
      if (!pin) return json({ error: "Could not allocate a free PIN" }, 409);

      const email = `${pin}@operator.prana.app`;
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password: `${pin}${operatorSecret}`, email_confirm: true,
      });
      if (cErr || !created?.user) throw cErr || new Error("createUser failed");
      const { error: pErr } = await admin.from("users").insert({
        id: created.user.id, name, role: "operator", login_code: pin, active: true,
      });
      if (pErr) { await admin.auth.admin.deleteUser(created.user.id); throw pErr; }
      return json({ ok: true, operator: { name, pin } }, 200);
    }

    if (action === "createManager") {
      const name = String(body?.name || "").trim();
      let username = String(body?.username || "").trim().toLowerCase();
      const role = body?.role === "admin" ? "admin" : "supervisor";
      if (name.length < 2) return json({ error: "Name is required" }, 400);
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
        return json({ error: "Username must be 3-32 chars: lowercase letters, digits, . _ -" }, 400);
      }
      const email = username.includes("@") ? username : `${username}@prana.app`;
      const password = strongPassword(14);
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (cErr || !created?.user) {
        const msg = String(cErr?.message || "").toLowerCase();
        if (msg.includes("already")) return json({ error: "That username is already taken" }, 409);
        throw cErr || new Error("createUser failed");
      }
      const { error: pErr } = await admin.from("users").insert({
        id: created.user.id, name, role, login_code: null, active: true,
      });
      if (pErr) { await admin.auth.admin.deleteUser(created.user.id); throw pErr; }
      return json({ ok: true, manager: { name, username, role, password } }, 200);
    }

    if (action === "setActive") {
      const id = String(body?.id || "");
      const active = Boolean(body?.active);
      if (!id) return json({ error: "Missing id" }, 400);
      if (id === userData.user.id && !active) {
        return json({ error: "You can't deactivate your own admin account" }, 400);
      }
      const { error } = await admin.from("users").update({ active }).eq("id", id);
      if (error) throw error;
      return json({ ok: true }, 200);
    }

    // Reset a MANAGER's password (incl. the admin's own — the in-app way to
    // rotate a compromised password). New password generated server-side,
    // returned once for the admin to hand over.
    if (action === "resetPassword") {
      const id = String(body?.id || "");
      if (!id) return json({ error: "Missing id" }, 400);
      const { data: target } = await admin
        .from("users").select("name, role").eq("id", id).single();
      if (!target) return json({ error: "User not found" }, 404);
      if (target.role === "operator") return json({ error: "Use Regenerate PIN for operators" }, 400);
      const password = strongPassword(14);
      const { data: updated, error: uErr } = await admin.auth.admin.updateUserById(id, { password });
      if (uErr) throw uErr;
      const email = updated?.user?.email || "";
      const username = email.replace(/@prana\.app$/, "");
      return json({ ok: true, manager: { name: target.name, username, password } }, 200);
    }

    // Regenerate an OPERATOR's PIN. The operator's auth identity is derived from
    // the PIN (email `<pin>@operator.prana.app`, password `<pin><OPERATOR_SECRET>`),
    // so email + password + profile login_code all rotate together.
    if (action === "regeneratePin") {
      const id = String(body?.id || "");
      if (!id) return json({ error: "Missing id" }, 400);
      const { data: target } = await admin
        .from("users").select("name, role").eq("id", id).single();
      if (!target) return json({ error: "User not found" }, 404);
      if (target.role !== "operator") return json({ error: "Use Reset password for managers" }, 400);
      const { data: existing } = await admin.from("users").select("login_code");
      const taken = new Set((existing || []).map((r: any) => String(r.login_code || "")));
      let pin = "";
      for (let i = 0; i < 200; i++) {
        const cand = String(100000 + randInt(900000));
        if (!taken.has(cand)) { pin = cand; break; }
      }
      if (!pin) return json({ error: "Could not allocate a free PIN" }, 409);
      const { error: uErr } = await admin.auth.admin.updateUserById(id, {
        email: `${pin}@operator.prana.app`,
        password: `${pin}${operatorSecret}`,
        email_confirm: true,
      });
      if (uErr) throw uErr;
      const { error: pErr } = await admin.from("users").update({ login_code: pin }).eq("id", id);
      if (pErr) throw pErr;
      return json({ ok: true, operator: { name: target.name, pin } }, 200);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    // Log the real cause server-side (Workers/Edge logs); never leak DB/internal
    // exception text to the browser.
    console.error("admin-users error:", action, String((e as Error)?.message || e));
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
