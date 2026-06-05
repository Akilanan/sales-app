# PRANA VENTURE — Production Tracking App

Daily production planning with **Plan vs Actual** tracking for CNC manufacturing
(railway / wind / marine). Operators log output after each of the three daily
shifts; supervisors and admins set plans and watch a live dashboard.

This is the **complete web app**: React + Vite + Tailwind frontend, and a
Supabase (PostgreSQL + Auth) backend. It runs in a **local demo mode out of the
box**, and switches to the real multi-user Supabase backend the moment you add
your project keys — no code changes.

---

## Quick start (local demo — no backend needed)

Requires **Node.js 18+**.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173) and log in:

| Role | How to log in |
|------|----------------|
| Operator | **Operator** tab → PIN **1001** (or 1002 / 1003) |
| Supervisor | **Manager** tab → `anita` / `anita123` |
| Admin | **Manager** tab → `admin` / `admin123` |

In demo mode data is stored in your browser (localStorage). Two devices won't
share data — that's exactly what the Supabase backend below fixes.

---

## The two modes

The UI imports its data layer from `src/lib/db.js`, which auto-selects:

- **Local demo** — when no Supabase env vars are set. Uses `src/lib/localDb.js`.
- **Supabase (production)** — when `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` are set. Uses `src/lib/supabaseClient.js`.

Both implementations expose the identical interface, so `App.jsx` never changes.

---

## Going live with Supabase

### 1. Create the database
1. Create a project at [supabase.com](https://supabase.com). From **Settings →
   API**, copy the **Project URL**, the **anon public** key, and the
   **service_role** key (keep this one secret).
2. In **SQL Editor**, run in order:
   - `supabase/migrations/0001_schema.sql` — the five tables + audit table,
     constraints, indexes, and the duplicate-entry guard.
   - `supabase/migrations/0002_rls_audit.sql` — Row-Level Security for the three
     roles + audit/`created_by` triggers.

### 2. Seed demo data (optional but recommended for testing)
Pick one:

- **Node (recommended — reliably creates Auth users):**
  ```bash
  SUPABASE_URL="https://YOUR-REF.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="YOUR-SERVICE-ROLE-KEY" \
  npm run seed
  ```
- **Pure SQL:** run `supabase/seed.sql` in the SQL Editor. If its auth-user
  section errors on your Supabase version, create the 5 users with the Node
  script (or **Authentication → Add user**) and re-run only Part B.

### 3. Point the app at Supabase
Create a `.env` file (copy `.env.example`):

```
VITE_SUPABASE_URL=https://YOUR-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

Restart `npm run dev`. The console logs `[PRANA] data layer: supabase`. Same
demo logins as above (operators by PIN, managers by `anita` / `admin`).

---

## How login maps to Supabase Auth

- **Managers** sign in with **email + password**. The *Username* field accepts a
  bare name (`anita`) or a full email; the client maps a bare name to
  `<name>@prana.app`.
- **Operators** sign in with a **PIN**. Each operator is a real Auth user with a
  synthetic email `<pin>@operator.prana.app`; the actual password is
  `PIN + OPERATOR_SECRET` (the operator only types the PIN). The PIN is also kept
  in `users.login_code`.

> **`OPERATOR_SECRET` must be identical** in `src/lib/supabaseClient.js`,
> `supabase/seed.mjs`, and `supabase/seed.sql`. Change it from the default — and
> change the demo passwords — before production.

PINs are intentionally low-entropy (fine for a trusted shop floor). For stronger
security, lengthen PINs, rotate `OPERATOR_SECRET`, or move to a kiosk model where
the tablet authenticates once and the PIN only attributes the entry.

---

## Deploy

No server to host — Supabase is the backend. Build the frontend and host the
static output.

**Vercel:** import the repo → Framework preset **Vite** → add env vars
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` → Deploy.

**Netlify:** Build command `npm run build`, Publish directory `dist`, add the
same two env vars under **Site settings → Environment variables** → Deploy.

---

## What the system enforces (business rules)

- **Shift 3 crosses midnight** (22:00–06:00): output is recorded against the date
  the shift *started* (the entry screen reminds operators).
- **No duplicate entries** for the same operator / component / shift / date —
  enforced by a DB `UNIQUE` constraint and mirrored in demo mode. The entry form
  also warns before the confirm step.
- **Roles:** operators can only log their own output; supervisors/admins set
  plans and correct or delete entries; admins have full access (enforced by RLS).
- **Working days** are editable per component, per month.
- **Components are deactivated, never deleted**, so production history stays
  intact.
- **Audit trail:** every supervisor/admin correction or deletion of an entry is
  logged to `entry_audit` (who, when, before/after).

---

## Project structure

```
prana-production-app/
├─ index.html
├─ package.json
├─ vite.config.js
├─ tailwind.config.js
├─ postcss.config.js
├─ .env.example
├─ src/
│  ├─ main.jsx                 # React entry
│  ├─ index.css                # Tailwind directives
│  ├─ App.jsx                  # the full UI: Login, Shift Entry, Dashboard, Plan Setup
│  └─ lib/
│     ├─ db.js                 # selects supabase vs local based on env
│     ├─ supabaseClient.js     # production data layer (Supabase)
│     └─ localDb.js            # demo data layer (localStorage)
└─ supabase/
   ├─ migrations/
   │  ├─ 0001_schema.sql        # tables, constraints, indexes, duplicate guard
   │  └─ 0002_rls_audit.sql     # RLS policies + audit/created_by triggers
   ├─ seed.sql                  # demo data (SQL)
   └─ seed.mjs                  # demo data (Node + Auth admin API)
```

---

## Security notes

- The **anon key is safe in the browser** — Row-Level Security is what protects
  the data. The **service_role key bypasses RLS**; use it only in `seed.mjs` or
  server-side code, never in the frontend or in git.
- Change `OPERATOR_SECRET` and all demo passwords before production.
- Adding users at runtime needs the service role, so it belongs in a small admin
  tool or a Supabase Edge Function (a Phase 2 addition, not included here).

## Optional next steps (Phase 2)
- A clean logout that also ends the Supabase session (`db.signOut()` exists).
- Surface the duplicate-entry message in the UI (wrap the entry submit in
  try/catch and show `err.message`).
- A real-time dashboard via Supabase Realtime subscriptions.
- Reports with date-range filters and Excel/PDF export; an admin screen for
  managing users, machines, and components.
