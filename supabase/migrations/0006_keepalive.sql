-- ============================================================================
-- 0006 · keepalive RPC
-- Target for the daily GitHub Action ping: a real DB round-trip that exposes
-- zero data. Supabase free tier pauses projects after ~7 days without
-- activity; the cron calls this through PostgREST to keep the project warm.
-- ============================================================================
create or replace function public.keepalive()
returns integer
language sql
stable
set search_path = public
as $$ select 1 $$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
