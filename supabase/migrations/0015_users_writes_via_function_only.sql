-- 0015: Remove the broad direct-write policy on public.users.
--
-- `users_admin_write` (FOR ALL using current_app_role()='admin') let any admin
-- INSERT/UPDATE/DELETE the users table directly over /rest/v1/users with their
-- own JWT — bypassing the admin-users edge function's guarantees (no
-- self-deactivate, role must be admin|supervisor, single-source-of-truth PIN
-- allocation). That made a last-admin lockout / self-role-change reachable.
--
-- All profile mutations already go exclusively through the admin-users edge
-- function, which uses the service-role key (bypasses RLS), so dropping this
-- policy changes nothing for legitimate flows. SELECT stays (users_select_self
-- + users_select_managers), so the app still reads profiles.

drop policy if exists users_admin_write on public.users;
