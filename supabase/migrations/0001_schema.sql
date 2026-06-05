-- ============================================================================
-- 0001_schema.sql  ·  PRANA VENTURE — core schema (Path A / Supabase Postgres)
-- Run in the Supabase SQL Editor, or via `supabase db push`.
-- ============================================================================

create extension if not exists pgcrypto;   -- for gen_random_uuid()

-- 1) USERS (profile table; primary key == auth.users.id) ---------------------
--    Credentials live in Supabase Auth (auth.users). This table holds role,
--    display name, and the operator PIN used to map a login to a profile.
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  role        text not null default 'operator'
              check (role in ('operator','supervisor','admin')),
  login_code  text unique,                 -- operator PIN; NULL for managers
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 2) MACHINES ----------------------------------------------------------------
create table if not exists public.machines (
  id      uuid primary key default gen_random_uuid(),
  code    text unique not null,
  name    text,
  active  boolean not null default true
);

-- 3) COMPONENTS --------------------------------------------------------------
create table if not exists public.components (
  id          uuid primary key default gen_random_uuid(),
  code        text unique,
  name        text not null,
  industry    text check (industry in ('railway','wind','marine','other') or industry is null),
  active      boolean not null default true,   -- deactivate instead of delete
  created_at  timestamptz not null default now()
);

-- 4) MONTHLY_PLANS (one row per component per month) -------------------------
create table if not exists public.monthly_plans (
  id            uuid primary key default gen_random_uuid(),
  month         date not null,               -- always the first day of the month
  component_id  uuid not null references public.components(id) on delete cascade,
  target_qty    integer not null default 0 check (target_qty >= 0),
  working_days  integer not null default 26 check (working_days between 1 and 31),
  unique (month, component_id)               -- working_days editable per month
);
create index if not exists idx_plans_month on public.monthly_plans(month);

-- 5) PRODUCTION_ENTRIES ------------------------------------------------------
create table if not exists public.production_entries (
  id               uuid primary key default gen_random_uuid(),
  production_date  date not null,            -- the date the SHIFT STARTED (Shift 3 = start day)
  shift            smallint not null check (shift in (1,2,3)),
  component_id     uuid not null references public.components(id),
  machine_id       uuid references public.machines(id),
  operator_id      uuid not null references public.users(id),
  quantity         integer not null check (quantity >= 0),
  scrap_qty        integer not null default 0 check (scrap_qty >= 0),
  notes            text,
  created_by       uuid references public.users(id),   -- set by trigger = auth.uid()
  created_at       timestamptz not null default now(),

  -- DUPLICATE GUARD: at most one row per operator + component + shift + date.
  constraint uniq_entry unique (production_date, shift, component_id, operator_id)
);
create index if not exists idx_entries_date       on public.production_entries(production_date);
create index if not exists idx_entries_component  on public.production_entries(component_id);
create index if not exists idx_entries_operator   on public.production_entries(operator_id);
create index if not exists idx_entries_date_shift on public.production_entries(production_date, shift);

-- 6) ENTRY_AUDIT (logs supervisor/admin corrections — writes via trigger) ----
create table if not exists public.entry_audit (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid,                          -- production_entries.id (kept even after delete)
  action      text not null check (action in ('update','delete')),
  changed_by  uuid references public.users(id),
  changed_at  timestamptz not null default now(),
  old_data    jsonb,
  new_data    jsonb                          -- NULL for deletes
);
create index if not exists idx_audit_entry on public.entry_audit(entry_id);
