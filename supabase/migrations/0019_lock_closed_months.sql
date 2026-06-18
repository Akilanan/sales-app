-- 0019 — Freeze closed months (Akilan's decision 2026-06-18).
-- Past months (strictly before the current month) become read-only at the server
-- for the planning tables, so a plan or machine-loading row can't be rewritten
-- after the month ends. Current + future months stay fully editable. Routing
-- (component_operations) is NOT month-scoped, so it is not locked. Production
-- entries (actuals) are NOT locked here — historical corrections stay possible.

create or replace function public.block_closed_month_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare cur date := date_trunc('month', current_date)::date;
begin
  -- block touching a row whose month is already closed (covers INSERT/UPDATE/DELETE
  -- and an UPDATE that tries to move a row INTO or OUT OF a closed month)
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

drop trigger if exists trg_monthly_plans_lock on public.monthly_plans;
create trigger trg_monthly_plans_lock
  before insert or update or delete on public.monthly_plans
  for each row execute function public.block_closed_month_writes();

drop trigger if exists trg_machine_plan_lines_lock on public.machine_plan_lines;
create trigger trg_machine_plan_lines_lock
  before insert or update or delete on public.machine_plan_lines
  for each row execute function public.block_closed_month_writes();

-- A trigger function fires via the trigger mechanism, not via EXECUTE — so revoke
-- the default RPC grant so it can't be reached at /rest/v1/rpc/ (it errors out of
-- trigger context anyway, but this closes the exposed surface / silences the lint).
revoke execute on function public.block_closed_month_writes() from anon, authenticated, public;
