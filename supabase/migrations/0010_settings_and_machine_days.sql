-- ============================================================================
-- 0010 · editable settings + per-machine working days
--   - machines.working_days / shifts: per-machine capacity (Sheet1 had these)
--   - app_settings: small key/value store; seeds target_hr = 2200
-- ============================================================================
alter table public.machines add column if not exists working_days integer not null default 24;
alter table public.machines add column if not exists shifts        integer not null default 3;

create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
create policy app_settings_read on public.app_settings
  for select using (auth.uid() is not null);
create policy app_settings_manage on public.app_settings
  for all using (public.current_app_role() in ('supervisor','admin'))
          with check (public.current_app_role() in ('supervisor','admin'));

insert into public.app_settings (key, value) values ('target_hr', '2200')
  on conflict (key) do nothing;
