// ============================================================================
// operator-login  ·  Supabase Edge Function
//
// Moves the operator PIN secret OFF the public frontend bundle. The browser
// sends only the PIN; this function (which holds OPERATOR_SECRET as a server
// secret) reconstructs the real password, signs the operator in, confirms they
// are an active operator, and returns the session tokens. The client then calls
// supabase.auth.setSession(...) with those tokens.
//
// Required secret (set once):  OPERATOR_SECRET  — MUST equal the value passed to
// the seed (`npm run seed:prod`). SUPABASE_URL / SUPABASE_ANON_KEY are injected
// by the platform automatically.
//
// verify_jwt stays ON: supabase.functions.invoke sends the public anon key as a
// valid JWT (gateway passes it); the real auth is the PIN check below.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
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
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("OPERATOR_SECRET");
  if (!url || !anon || !secret) return json({ error: "Server not configured" }, 500);

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: `${pin}@operator.prana.app`,
    password: `${pin}${secret}`,
  });
  if (error || !data?.session || !data?.user) return json({ error: "Invalid PIN" }, 401);

  // Only hand back a session for an ACTIVE operator profile.
  const { data: profile } = await supabase
    .from("users").select("role, active").eq("id", data.user.id).single();
  if (!profile || profile.role !== "operator" || profile.active !== true) {
    return json({ error: "Not an active operator" }, 403);
  }

  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  }, 200);
});
