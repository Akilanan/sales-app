-- 0022 — Hardening from the full-app audit (2026-06-18).
-- Closes five verified defense-in-depth / data-integrity gaps found by the audit.

-- (#5) Freeze closed months for machine_breakdowns too. 0019 locked monthly_plans
-- and machine_plan_lines, but a down/up toggle on a past month still mutated that
-- frozen month's capacity. The trigger fn already reads new.month/old.month.
drop trigger if exists trg_machine_breakdowns_lock on public.machine_breakdowns;
create trigger trg_machine_breakdowns_lock
  before insert or update or delete on public.machine_breakdowns
  for each row execute function public.block_closed_month_writes();

-- (#19) Pin the month-lock boundary to the shop's timezone (IST) so the server's
-- "current month" matches the client's curMonth() (which uses the browser's local
-- date). Avoids a ~5.5h nightly window on the 1st where the two disagree.
create or replace function public.block_closed_month_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare cur date := date_trunc('month', (now() at time zone 'Asia/Kolkata'))::date;
begin
  if tg_op in ('UPDATE','DELETE')
     and date_trunc('month', old.month)::date < cur then
    raise exception 'Month % is closed and can no longer be edited.', to_char(old.month, 'YYYY-MM')
      using errcode = 'check_violation';
  end if;
  if tg_op in ('INSERT','UPDATE')
     and date_trunc('month', new.month)::date < cur then
    raise exception 'Month % is closed and can no longer be edited.', to_char(new.month, 'YYYY-MM')
      using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke execute on function public.block_closed_month_writes() from anon, authenticated, public;

-- (#16) Revoke the stale table-level write grants on public.users. All user
-- mutation already goes through the admin-users edge function (service role). RLS
-- has no write policy today, so this isn't exploitable now — but it means a future
-- accidental self-service write policy can't expose role/active to self-promotion.
revoke insert, update, delete on public.users from anon, authenticated;

-- (#18) machine_plan_lines.qty had no non-negative CHECK (unlike its sibling
-- quantity columns), so a direct REST PATCH could persist a negative loading qty
-- that poisons every capacity/costing/re-routing number.
alter table public.machine_plan_lines
  drop constraint if exists mpl_qty_nonneg;
alter table public.machine_plan_lines
  add constraint mpl_qty_nonneg check (qty >= 0);

-- (#28) A reason without its quantity is meaningless. Keep scrap_reason tied to
-- scrap and downtime_reason tied to downtime (the UI already conforms; this stops
-- a direct REST insert from polluting the WHY/OEE dataset).
alter table public.production_entries
  drop constraint if exists pe_scrap_reason_needs_scrap;
alter table public.production_entries
  add constraint pe_scrap_reason_needs_scrap check (scrap_reason is null or scrap_qty > 0);
alter table public.production_entries
  drop constraint if exists pe_downtime_reason_needs_downtime;
alter table public.production_entries
  add constraint pe_downtime_reason_needs_downtime check (downtime_reason is null or downtime_minutes > 0);
