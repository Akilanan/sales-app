-- ============================================================================
-- 0007 · component_operations  (Phase 1 of the production-planning module)
--
-- Each component (part) has an ordered list of machining OPERATIONS — mirroring
-- the "Opn / Cy.Time / Set.Time / Ins.Time" rows in Akilan's HMC&VMC sheets.
-- This is the routing foundation: later phases compute machine-hours, days, and
-- schedules from these per-operation times.
--
-- Capacity formulas (verified 1:1 against the Excel) live in the app:
--   MC Hrs = (qty*cycle_time + setup_time + insertion_time) / 60
--   LB Hrs = MC Hrs / 12 ; Total = MC+LB ; Eff = Total*1.05 ; Days = Eff/17
-- ============================================================================
create table if not exists public.component_operations (
  id              uuid primary key default gen_random_uuid(),
  component_id    uuid not null references public.components(id) on delete cascade,
  op_no           integer not null,                 -- 30,40,50,60,70 ...
  description     text,                              -- optional op label (e.g. "Rough mill")
  cycle_time      numeric not null default 0,        -- per-piece, seconds
  setup_time      numeric not null default 0,        -- seconds
  insertion_time  numeric not null default 60,       -- seconds (sheet default 60)
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (component_id, op_no)
);

create index if not exists component_operations_component_idx
  on public.component_operations (component_id);

alter table public.component_operations enable row level security;

-- Anyone signed in can read the routing; only supervisors/admins edit it.
create policy component_operations_read on public.component_operations
  for select using (auth.uid() is not null);
create policy component_operations_manage on public.component_operations
  for all using (public.current_app_role() in ('supervisor','admin'))
          with check (public.current_app_role() in ('supervisor','admin'));
