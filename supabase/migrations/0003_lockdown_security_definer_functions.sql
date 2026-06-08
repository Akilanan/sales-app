-- ============================================================================
-- 0003_lockdown_security_definer_functions.sql
-- Security hardening — run AFTER 0001 and 0002.
--
-- The four SECURITY DEFINER functions below run via database triggers, an event
-- trigger, and RLS policy evaluation — they are NEVER meant to be called from
-- the public REST API (/rest/v1/rpc/...). The Supabase linter flags them as
-- "Public/Signed-in users can execute SECURITY DEFINER function". This migration
-- revokes that direct API access. Triggers, the event trigger, and RLS keep
-- working unchanged (they don't depend on the caller's EXECUTE grant).
--
--   current_app_role()  -> called inside RLS policies  (authenticated MUST keep it)
--   set_created_by()    -> trigger trg_set_created_by   (trigger-only)
--   log_entry_change()  -> trigger trg_entry_audit      (trigger-only)
--   rls_auto_enable()   -> event trigger ensure_rls     (event-trigger-only)
-- ============================================================================

-- Role helper used by every RLS policy: remove public/anon access, but keep the
-- explicit grant to `authenticated` (policy evaluation calls it on each query).
revoke all on function public.current_app_role() from public;
revoke all on function public.current_app_role() from anon;
grant execute on function public.current_app_role() to authenticated;

-- Pure trigger / event-trigger functions — no API caller should reach these.
revoke all on function public.set_created_by()   from public, anon, authenticated;
revoke all on function public.log_entry_change() from public, anon, authenticated;
revoke all on function public.rls_auto_enable()  from public, anon, authenticated;
