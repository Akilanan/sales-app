-- ============================================================================
-- 0008 · machine_plan_lines  (Phase 2 of the production-planning module)
--
-- Each row = "produce `qty` of this component on this machine, this month."
-- The app expands each line over the component's operations (Phase 1) to roll
-- up the machine's total load in DAYS and compare it to the working month —
-- exactly the per-machine planning your HMC&VMC sheets do, one tab per machine.
-- ============================================================================
create table if not exists public.machine_plan_lines (
  id            uuid primary key default gen_random_uuid(),
  month         date not null,                       -- first of the month
  machine_id    uuid not null references public.machines(id)   on delete cascade,
  component_id  uuid not null references public.components(id) on delete cascade,
  qty           integer not null default 0,
  seq           integer not null default 0,          -- order within the machine
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists machine_plan_lines_month_machine_idx
  on public.machine_plan_lines (month, machine_id);

alter table public.machine_plan_lines enable row level security;

create policy machine_plan_lines_read on public.machine_plan_lines
  for select using (auth.uid() is not null);
create policy machine_plan_lines_manage on public.machine_plan_lines
  for all using (public.current_app_role() in ('supervisor','admin'))
          with check (public.current_app_role() in ('supervisor','admin'));
