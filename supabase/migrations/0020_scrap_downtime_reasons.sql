-- 0020 — Capture WHY, not just WHAT (Akilan's decision 2026-06-18).
-- The #1 operational gap: today the floor logs good/scrap counts but never the
-- reason, so OEE / true-cost can't be computed. Add structured scrap + downtime
-- reason capture to each production entry. Reasons are stored as text (the UI
-- offers fixed tap-chip defaults the admin can extend later).
alter table public.production_entries
  add column if not exists scrap_reason     text,
  add column if not exists downtime_minutes integer not null default 0,
  add column if not exists downtime_reason  text;

alter table public.production_entries
  drop constraint if exists pe_downtime_minutes_nonneg;
alter table public.production_entries
  add constraint pe_downtime_minutes_nonneg check (downtime_minutes >= 0);
