-- ============================================================================
-- 0004_enable_realtime.sql  ·  Live cross-device sync
-- Run AFTER 0003.
--
-- Adds the changing tables to the `supabase_realtime` publication so the client
-- receives postgres_changes events (operator logs output -> every manager's
-- dashboard and the operator's own "recent entries" update within ~1s, on any
-- tablet/desktop, with no refresh). Row-Level Security still applies to the
-- realtime stream: operators only receive events for their OWN entries, managers
-- receive all — the same rules as a normal read. machines rarely change, so it
-- is intentionally left off the live stream.
--
-- Idempotent: safe to re-run (only adds a table if it isn't already published).
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['production_entries', 'monthly_plans', 'components']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
