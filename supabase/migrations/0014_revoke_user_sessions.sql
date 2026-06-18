-- 0014: revoke_user_sessions(uid) — hard-revoke all of a user's auth sessions.
--
-- Used by the admin-users edge function when an admin DEACTIVATES a user. The
-- `active` flag is only consulted at login, so without this a deactivated user's
-- already-issued, auto-refreshing JWT would keep full RLS access until they
-- happened to sign out. Deleting their auth.sessions (which cascades to
-- auth.refresh_tokens) stops any new access token from being minted; the
-- client's onAuthStateChange then fires SIGNED_OUT on the next refresh.
--
-- SECURITY DEFINER so the service-role caller can reach the internal auth schema;
-- execute is locked to service_role only (never anon/authenticated).

create or replace function public.revoke_user_sessions(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  delete from auth.refresh_tokens where user_id = p_uid::text;
  delete from auth.sessions where user_id = p_uid;
end;
$$;

revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
