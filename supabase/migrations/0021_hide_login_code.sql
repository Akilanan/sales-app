-- 0021 — Hide cleartext operator PINs (users.login_code) from direct API reads.
--
-- users_select_managers granted supervisors SELECT on ALL columns of every user
-- row, including login_code (the cleartext operator PIN), so a supervisor could
-- GET /rest/v1/users?select=login_code and read every operator's live PIN. PIN
-- reveal is meant to be an ADMIN-only Team action (via the admin-users edge
-- function, which uses the service role and bypasses column grants).
--
-- Fix: replace the all-column SELECT grant with an explicit column list that
-- EXCLUDES login_code. RLS still scopes WHICH rows each role sees; this scopes
-- which COLUMNS are even readable.
--   - admin-users (service role) still reads/writes login_code for the Team screen
--   - operator-login never reads login_code (it reconstructs the password)
--   - the client profileOf()/listUsersLite() select explicit non-PIN columns
-- so nothing in the app breaks.
revoke select on public.users from authenticated, anon;
grant select (id, name, role, active, created_at) on public.users to authenticated, anon;
