# PRANA VENTURE — Production Deployment Runbook

Goal: run this app **24/7 for the whole company, free of cost**, with a **unique
strong login for every employee**, reachable from anywhere over the internet.

## Architecture (what runs where)

```
  Employees' phones / PCs
        |  (internet — open a URL, log in)
        v
  [ Vercel ]        <- the app's screens (static files)   FREE, always-on
        |
        v
  [ Supabase ]      <- database + logins + security rules  FREE tier
```

- **Your laptop is only for setup**, not for running the app. Once deployed,
  you can close it; the app stays online.
- **The company server is not needed** for this cloud setup. (It's noted for the
  future if you ever want to self-host.)

## Accounts you need (all free)

| Service | Used for | Cost |
|---|---|---|
| Supabase | Database + logins | Free tier |
| GitHub | Stores the code so Vercel can deploy it | Free |
| Vercel | Hosts the app, gives a permanent URL | Free (Hobby) |

---

## Phase 0 — Security first (do this once)

**0.1 Rotate the exposed service_role key.** It was pasted into chat earlier, so
treat it as leaked. Supabase → **Settings → API → service_role → Reset**. Copy
the new one; you'll use it only in your terminal in Phase 2 (never in the app,
never in git).

**0.2 Generate your OPERATOR_SECRET** (a long random string that hardens operator
PIN logins). In a terminal:

```powershell
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Save the output somewhere safe (a password manager). You'll paste the **same**
value in two places: `VITE_OPERATOR_SECRET` (the app) and `OPERATOR_SECRET` (the
seed). They must match or operators can't log in.

---

## Phase 1 — Create the database schema

Supabase → **SQL Editor** → run these two files **in order** (open each from the
repo, paste, Run):

1. `supabase/migrations/0001_schema.sql`  — the tables
2. `supabase/migrations/0002_rls_audit.sql` — the security rules (Row-Level
   Security) and audit trail

You only do this once per project.

---

## Phase 2 — Create your real users + data (generates passwords)

**2.1 Fill in your company details.** Copy the template and edit it with your
real people, machines, and components:

```powershell
Copy-Item supabase\company.config.example.json supabase\company.config.json
```

Open `supabase/company.config.json` and edit:
- **operators** — each shop-floor worker + a unique PIN (3–8 digits). They log in
  with just the PIN.
- **managers** — supervisors/admins. Give a short `username` (e.g. `anita`); the
  script generates a strong password for each.
- **machines** — your CNC machine codes (there's no in-app screen to add machines
  yet, so list them here).
- **components** — what you produce. `industry` must be `railway`, `wind`,
  `marine`, `other`, or omitted. `target` = monthly target qty.

This file is **gitignored** — it never gets committed.

**2.2 Run the production seed** in your terminal (PowerShell), pasting the FRESH
service_role key and your OPERATOR_SECRET — these stay in your terminal only:

```powershell
$env:SUPABASE_URL = "https://czfhyqvpfulpwpsgempf.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<fresh service_role key from Phase 0.1>"
$env:OPERATOR_SECRET = "<the value from Phase 0.2>"
npm run seed:prod
```

It prints `Seeded N operators, M managers, ...` and writes **`CREDENTIALS.txt`**
in the project root — a printable sheet of every login. This file is gitignored.
**Print it, give each person only their own line, then delete it.**

---

## Phase 3 — Put the code on GitHub

If the repo isn't on GitHub yet (using the GitHub CLI, which prompts you to log
in in the browser):

```powershell
gh auth login
gh repo create prana-production-app --private --source . --remote origin --push
```

(Or create an empty private repo on github.com and `git push` to it.) Your secret
files — `.env`, `company.config.json`, `CREDENTIALS.txt` — are gitignored and
will **not** be uploaded. Verify with `git status` before pushing.

---

## Phase 4 — Deploy on Vercel (the always-on part)

1. Go to **vercel.com** → sign in with GitHub (free "Hobby" plan).
2. **Add New → Project → Import** your `prana-production-app` repo.
3. Vercel auto-detects **Vite**. Leave build settings as-is
   (build: `npm run build`, output: `dist`).
4. Expand **Environment Variables** and add **three** (mark them for all
   environments):
   - `VITE_SUPABASE_URL` = `https://czfhyqvpfulpwpsgempf.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = your anon public key (Supabase → Settings → API)
   - `VITE_OPERATOR_SECRET` = the **same** value from Phase 0.2
5. Click **Deploy**. After ~1 minute you get a permanent URL like
   `https://prana-production-app.vercel.app`. That URL is your company app — share
   it with employees.

> Do **not** add the service_role key to Vercel. It is never used by the app.

Every time you `git push` to the main branch later, Vercel rebuilds and updates
the live site automatically.

---

## Phase 5 — Verify & hand out logins

1. Open your Vercel URL on your phone (mobile data, to prove it works off your
   network).
2. **Operator tab** → a PIN from your config → you should reach the shift-entry
   screen.
3. **Manager tab** → an admin username + the generated password → dashboard.
4. Hand out logins from `CREDENTIALS.txt`, then **delete the file**.

---

## Running it day-to-day

- **Add a new employee later:** edit `supabase/company.config.json`, re-run
  `npm run seed:prod` (existing users keep working; new ones are created; note
  that re-running regenerates manager passwords — see the new `CREDENTIALS.txt`).
- **Add components:** an admin can do this in the app. **Add machines:** edit the
  config and re-run the seed (no in-app screen for machines yet).
- **Deactivate someone:** set `"active": false` for them in the DB (Supabase →
  Table editor → `users`), or ask me to add an admin toggle.

## Backups (recommended)

Supabase free tier keeps your data but does **not** include automatic daily
backups. Once a month (or weekly), export a snapshot:
Supabase → **Database → Backups** (or **Table editor → export CSV** per table).
Ask me and I can add a one-command export script.

## Cost & limits (staying free)

Supabase free tier: 500 MB database (years of production logs for a CNC shop),
50,000 monthly active users, 5 GB bandwidth. It only pauses after **7 days of no
activity** — a daily-use app never pauses. Vercel Hobby is free for this static
app. **Net cost: $0.** If you ever outgrow it, Supabase Pro is ~$25/mo, but you
are nowhere near that.

## Optional niceties (ask me)

- A custom domain (e.g. `prana.yourcompany.com`) instead of the `.vercel.app` URL.
- An in-app admin screen to manage users/machines (removes the re-seed step).
- Automatic database backups to a file/Drive on a schedule.

---

## Security checklist before go-live

- [ ] service_role key **rotated** (Phase 0.1) and never committed/shared.
- [ ] `VITE_OPERATOR_SECRET` set in Vercel and matches the seed's `OPERATOR_SECRET`.
- [ ] Demo logins (`admin/admin123`, PIN `1001`, etc.) are **not** used — your
      `company.config.json` has real people only.
- [ ] `git status` shows no `.env`, `company.config.json`, or `CREDENTIALS.txt`.
- [ ] `CREDENTIALS.txt` deleted after handing out logins.
- [ ] Operators understand PINs are personal (output is attributed to them).
