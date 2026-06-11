// Pre-deploy gate: a production bundle built WITHOUT the Supabase env vars
// boots into CONFIG_ERROR (src/lib/db.js) — deploying it takes prod down.
// This script fails the deploy unless the built JS contains the project URL.
// Vite loads .env.production at build time (copy of .env.supabase, gitignored).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REF = "czfhyqvpfulpwpsgempf"; // prana-venture-production project ref (public — it's in every API URL)
const dir = join(process.cwd(), "dist", "assets");

let found = false;
try {
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".js")) continue;
    if (readFileSync(join(dir, f), "utf8").includes(REF)) { found = true; break; }
  }
} catch (e) {
  console.error("check-dist: cannot read dist/assets — run `npm run build` first.", e.message);
  process.exit(1);
}

if (!found) {
  console.error(
    "\n✗ DEPLOY BLOCKED: the built bundle has NO Supabase config baked in.\n" +
    "  This build would refuse to run in production (CONFIG_ERROR screen).\n" +
    "  Fix: ensure .env.production exists with VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY\n" +
    "  (copy .env.supabase → .env.production), then `npm run build` again.\n"
  );
  process.exit(1);
}
console.log("✓ check-dist: Supabase config present in the bundle — safe to deploy.");
