-- 0016: machine_breakdowns — a machine marked DOWN for a given month.
-- A row (machine_id, month) means that machine is unavailable for that whole
-- month (its capacity → 0); the Loading screen redistributes its parts.
-- Any signed-in user may READ which machines are down (not sensitive); only
-- managers (supervisor/admin) may mark/clear breakdowns.

create table if not exists public.machine_breakdowns (
  machine_id uuid not null references public.machines(id) on delete cascade,
  month      date not null,
  note       text,
  created_at timestamptz not null default now(),
  primary key (machine_id, month)
);

alter table public.machine_breakdowns enable row level security;

create policy mb_select on public.machine_breakdowns
  for select using (auth.uid() is not null);

create policy mb_write on public.machine_breakdowns
  for all
  using (public.current_app_role() in ('supervisor','admin'))
  with check (public.current_app_role() in ('supervisor','admin'));

create index if not exists idx_machine_breakdowns_month on public.machine_breakdowns(month);
