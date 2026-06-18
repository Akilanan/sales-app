-- 0018 — Operator read-lockdown + costing confidentiality (least-privilege).
--
-- Operators log in with a PIN and hold a REAL Supabase JWT, so the old
-- "auth.uid() is not null" SELECT policies let an operator read every part rate,
-- the full loading plan, routing, costing settings, breakdowns and eligibility
-- straight from the REST API — the UI only hid the tabs, the server did not
-- protect the data. Decisions (Akilan, 2026-06-18): operators must NEVER see
-- money; costing is ADMIN-only to change.
--
-- After this migration an OPERATOR can still read only what Shift Entry needs:
--   components (name/code/industry — NO rate), machines, the month's quantity
--   targets (monthly_plans), and their OWN production_entries.
-- Everything financial / planning-detail is managers-only; rate writes admin-only.

-- 1) Move the ₹ per-piece rate OUT of the operator-readable components table ----
create table if not exists public.component_rates (
  component_id uuid primary key references public.components(id) on delete cascade,
  rate         numeric not null default 0,
  updated_at   timestamptz not null default now()
);

-- carry existing rates across before dropping the column
insert into public.component_rates (component_id, rate)
  select id, coalesce(rate, 0) from public.components
  on conflict (component_id) do update set rate = excluded.rate;

alter table public.component_rates enable row level security;

-- READ: supervisors + admins (costing display).  WRITE: admins only (B3).
drop policy if exists component_rates_read on public.component_rates;
create policy component_rates_read on public.component_rates
  for select using (public.current_app_role() in ('supervisor','admin'));

drop policy if exists component_rates_admin_write on public.component_rates;
create policy component_rates_admin_write on public.component_rates
  for all
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- the ₹ column no longer lives on the operator-readable table
alter table public.components drop column if exists rate;

-- 2) Restrict planning / costing / execution READS to managers ----------------
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select using (public.current_app_role() in ('supervisor','admin'));

drop policy if exists machine_plan_lines_read on public.machine_plan_lines;
create policy machine_plan_lines_read on public.machine_plan_lines
  for select using (public.current_app_role() in ('supervisor','admin'));

drop policy if exists component_operations_read on public.component_operations;
create policy component_operations_read on public.component_operations
  for select using (public.current_app_role() in ('supervisor','admin'));

drop policy if exists mb_select on public.machine_breakdowns;
create policy mb_select on public.machine_breakdowns
  for select using (public.current_app_role() in ('supervisor','admin'));

drop policy if exists cm_select on public.component_machines;
create policy cm_select on public.component_machines
  for select using (public.current_app_role() in ('supervisor','admin'));

-- 3) Costing settings (machine_rate, target_hr) are ADMIN-only to WRITE (B3) ---
-- Supervisors keep planning + loading but can no longer change the ₹/hr that
-- drives every margin/loss number. Reads stay managers-only via app_settings_read.
drop policy if exists app_settings_manage on public.app_settings;
create policy app_settings_admin_write on public.app_settings
  for all
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- NOTE: monthly_plans, machines and components stay readable by operators on
-- purpose — operators may see part names and their own SHIFT QUANTITY TARGET
-- (motivational); none of those carry ₹. components no longer has a rate column.
