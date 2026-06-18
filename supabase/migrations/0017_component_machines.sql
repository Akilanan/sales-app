-- 0017: component_machines — OPTIONAL machine-eligibility (routing flexibility).
-- A row (component_id, machine_id) means that part is ALLOWED to run on that
-- machine. The rule is "all-allowed by default": if a component has NO rows it
-- may run on any machine; once it has ≥1 row, ONLY those machines are eligible.
-- Models the standard machine-eligibility / processing-set constraint (Mj).
-- Any signed-in user may READ; only managers may edit the allow-list.

create table if not exists public.component_machines (
  component_id uuid not null references public.components(id) on delete cascade,
  machine_id   uuid not null references public.machines(id) on delete cascade,
  primary key (component_id, machine_id)
);

alter table public.component_machines enable row level security;

create policy cm_select on public.component_machines
  for select using (auth.uid() is not null);

create policy cm_write on public.component_machines
  for all
  using (public.current_app_role() in ('supervisor','admin'))
  with check (public.current_app_role() in ('supervisor','admin'));
