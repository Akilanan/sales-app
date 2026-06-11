// ============================================================================
// operator-login  ·  Supabase Edge Function
//
// Moves the operator PIN secret OFF the public frontend bundle. The browser
// sends only the PIN; this function (which holds OPERATOR_SECRET as a server
// secret) reconstructs the real password, signs the operator in, confirms they
// are an active operator, and returns the session tokens. The client then calls
// supabase.auth.setSession(...) with those tokens.
//
// Required secret:
//   OPERATOR_SECRET   — MUST equal the value passed to `npm run seed:prod`.
//   SUPABASE_URL / SUPABASE_SECRET_KEYS — injected by the platform.
// Optional:
//   PUBLIC_API_KEY    — the project's sb_publishable_ key for the sign-in client
//                       (least-privilege). If unset it falls back to the injected
//                       secret key — NO hardcoded fallback (the old stale-key risk
//                       is gone) and the shop floor can't be locked out by a missed
//                       secret.
//   ALLOWED_ORIGINS   — comma-separated CORS allow-list (defaults to prod).
//   OP_IP_LIMIT / OP_IP_WINDOW / OP_PIN_LIMIT / OP_PIN_WINDOW — throttle tuning.
//
// verify_jwt is OFF (2026-06-10): the app authenticates with the modern
// sb_publishable_ key, which is NOT a JWT — the gateway's JWT check would 401
// every request. The real auth here is the PIN check + the per-IP/per-PIN
// throttle below; legacy anon/service_role keys are disabled project-wide.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ---- secret key (auto-injected JSON dict), used ONLY for the throttle RPC ----
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

// ---- CORS locked to the production origin (overridable via ALLOWED_ORIGINS) --
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

const num = (v: string | undefined, d: number) => {
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let pin = "";
  try {
    const body = await req.json();
    pin = String(body?.pin ?? "").trim();
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  if (!/^\d{3,8}$/.test(pin)) return json({ error: "Invalid PIN" }, 400);

  const url = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("OPERATOR_SECRET");
  const secretKey = getSecretKey();
  // Sign-in apikey: prefer the publishable key (RLS-scoped, least-privilege), but
  // fall back to the auto-injected secret key — NO hardcoded string. This keeps
  // the old stale-key risk gone while never locking the 24/7 shop floor out over
  // an unset PUBLIC_API_KEY (the secret key is always platform-injected).
  const anon = Deno.env.get("PUBLIC_API_KEY") || secretKey;
  if (!url || !anon || !secret || !secretKey) return json({ error: "Server not configured" }, 500);

  // ---- throttle: per source IP and per PIN, before any sign-in attempt --------
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || req.headers.get("x-real-ip") || "unknown";
  const svc = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ipBucket = `op:ip:${ip}`;
  const pinBucket = `op:pin:${pin}`;
  try {
    const [{ data: ipOk }, { data: pinOk }] = await Promise.all([
      svc.rpc("hit_login_throttle", { p_bucket: ipBucket, p_limit: num(Deno.env.get("OP_IP_LIMIT"), 40), p_window_secs: num(Deno.env.get("OP_IP_WINDOW"), 300) }),
      svc.rpc("hit_login_throttle", { p_bucket: pinBucket, p_limit: num(Deno.env.get("OP_PIN_LIMIT"), 6), p_window_secs: num(Deno.env.get("OP_PIN_WINDOW"), 900) }),
    ]);
    if (ipOk === false || pinOk === false) {
      return json({ error: "Too many attempts. Please wait a minute and try again." }, 429);
    }
  } catch (_e) {
    // Throttle RPC unavailable → fail OPEN (never lock the shop floor out over a
    // throttle hiccup); the PIN check below is still the real gate.
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: `${pin}@operator.prana.app`,
    password: `${pin}${secret}`,
  });
  if (error || !data?.session || !data?.user) {
    await sleep(250); // small constant delay blunts timing/rate of enumeration
    return json({ error: "Invalid PIN" }, 401);
  }

  // Only hand back a session for an ACTIVE operator profile.
  const { data: profile } = await supabase
    .from("users").select("role, active").eq("id", data.user.id).single();
  if (!profile || profile.role !== "operator" || profile.active !== true) {
    return json({ error: "Not an active operator" }, 403);
  }

  // Success → clear this PIN's throttle so a legit fat-finger doesn't compound.
  try { await svc.rpc("clear_login_throttle", { p_bucket: pinBucket }); } catch { /* best-effort */ }

  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  }, 200);
});
