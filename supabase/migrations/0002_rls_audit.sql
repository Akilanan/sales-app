-- ============================================================================
-- 0002_rls_audit.sql  ·  Row-Level Security, role helper, and audit triggers
-- Run AFTER 0001_schema.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: the current user's app role. SECURITY DEFINER so it can read
-- public.users without tripping RLS (prevents recursive policy evaluation).
-- ----------------------------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;
revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: stamp created_by = auth.uid() on insert (cannot be spoofed by client)
-- ----------------------------------------------------------------------------
create or replace function public.set_created_by()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_by := auth.uid();
  return new;
end; $$;

drop trigger if exists trg_set_created_by on public.production_entries;
create trigger trg_set_created_by
  before insert on public.production_entries
  for each row execute function public.set_created_by();

-- ----------------------------------------------------------------------------
-- Trigger: audit every UPDATE / DELETE on production_entries.
-- SECURITY DEFINER lets it write entry_audit regardless of the caller's RLS.
-- ----------------------------------------------------------------------------
create or replace function public.log_entry_change()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'UPDATE') then
    insert into public.entry_audit(entry_id, action, changed_by, old_data, new_data)
    values (old.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.entry_audit(entry_id, action, changed_by, old_data, new_data)
    values (old.id, 'delete', auth.uid(), to_jsonb(old), null);
    return old;
  end if;
  return null;
end; $$;

drop trigger if exists trg_entry_audit on public.production_entries;
create trigger trg_entry_audit
  after update or delete on public.production_entries
  for each row execute function public.log_entry_change();

-- ----------------------------------------------------------------------------
-- Enable RLS on every table
-- ----------------------------------------------------------------------------
alter table public.users              enable row level security;
alter table public.machines           enable row level security;
alter table public.components         enable row level security;
alter table public.monthly_plans      enable row level security;
alter table public.production_entries enable row level security;
alter table public.entry_audit        enable row level security;

-- ============================ USERS =========================================
-- Anyone can read their own profile (needed right after sign-in to learn role).
create policy users_select_self on public.users
  for select using (id = auth.uid());
-- Managers can read all profiles (to show operator names on entries).
create policy users_select_managers on public.users
  for select using (public.current_app_role() in ('supervisor','admin'));
-- Only admins create/modify/deactivate user profiles.
create policy users_admin_write on public.users
  for all using (public.current_app_role() = 'admin')
          with check (public.current_app_role() = 'admin');

-- ========================== MACHINES (reference) ============================
create policy machines_read on public.machines
  for select using (auth.uid() is not null);
create policy machines_manage on public.machines
  for all using (public.current_app_role() in ('supervisor','admin'))
          with check (public.current_app_role() in ('supervisor','admin'));

-- ========================= COMPONENTS (reference) ===========================
create policy components_read on public.components
  for select using (auth.uid() is not null);
create policy components_manage on public.components
  for all using (public.current_app_role() in ('supervisor','admin'))
          with check (public.current_app_role() in ('supervisor','admin'));

-- =========================== MONTHLY_PLANS ==================================
create policy plans_read on public.monthly_plans
  for select using (auth.uid() is not null);
-- Set / change plans: supervisor or admin.
create policy plans_manage on public.monthly_plans
  for all using (public.current_app_role() in ('supervisor','admin'))
          with check (public.current_app_role() in ('supervisor','admin'));

-- ========================= PRODUCTION_ENTRIES ===============================
-- READ: operators see only their own; managers see everything.
create policy entries_select_own on public.production_entries
  for select using (operator_id = auth.uid());
create policy entries_select_managers on public.production_entries
  for select using (public.current_app_role() in ('supervisor','admin'));

-- INSERT: a user may only log output for THEMSELVES (operator_id = auth.uid()).
-- This is how "operators can only INSERT their own entries" is enforced.
create policy entries_insert_self on public.production_entries
  for insert with check (operator_id = auth.uid());

-- UPDATE / DELETE (correct or remove an entry): supervisor or admin only.
create policy entries_update_managers on public.production_entries
  for update using (public.current_app_role() in ('supervisor','admin'))
             with check (public.current_app_role() in ('supervisor','admin'));
create policy entries_delete_managers on public.production_entries
  for delete using (public.current_app_role() in ('supervisor','admin'));

-- ADMIN: full access (e.g. insert on behalf of an operator).
create policy entries_admin_all on public.production_entries
  for all using (public.current_app_role() = 'admin')
          with check (public.current_app_role() = 'admin');

-- ============================ ENTRY_AUDIT ===================================
-- Read-only to managers. Rows are written solely by the SECURITY DEFINER
-- trigger above — there is intentionally no client INSERT/UPDATE/DELETE policy.
create policy audit_read_managers on public.entry_audit
  for select using (public.current_app_role() in ('supervisor','admin'));
