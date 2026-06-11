-- 0013: Server-side login throttle for the public operator-login edge function.
--
-- operator-login is a public endpoint (verify_jwt OFF) whose only secret is the
-- PIN. Without a brake, a script could enumerate the PIN space and a hit returns
-- real session tokens. This adds a tiny fixed-window counter, called by the edge
-- function (with the secret key) per source IP and per PIN before it ever attempts
-- a sign-in. Combined with 6-digit PINs for new operators, enumeration becomes
-- infeasible. The function is the ONLY caller — REST execute is revoked from the
-- public/anon/authenticated roles so the publishable key can't poke it directly.

create table if not exists public.auth_throttle (
  bucket        text primary key,
  count         integer     not null default 0,
  window_start  timestamptz not null default now()
);
-- No RLS policies → no anon/authenticated access at all (only the service role,
-- which bypasses RLS, can touch it via the RPC below).
alter table public.auth_throttle enable row level security;

-- Atomically record one attempt for `bucket`; return TRUE if still under the
-- limit for the current window, FALSE if the caller should be refused (429).
-- A fresh window resets the counter. SECURITY DEFINER so it runs as the owner
-- regardless of the (service-role) caller; search_path pinned for safety.
create or replace function public.hit_login_throttle(
  p_bucket text, p_limit integer, p_window_secs integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now    timestamptz := now();
  v_count  integer;
  v_start  timestamptz;
begin
  insert into public.auth_throttle (bucket, count, window_start)
    values (p_bucket, 0, v_now)
    on conflict (bucket) do nothing;

  select count, window_start into v_count, v_start
    from public.auth_throttle where bucket = p_bucket for update;

  if v_now - v_start > make_interval(secs => p_window_secs) then
    update public.auth_throttle set count = 1, window_start = v_now where bucket = p_bucket;
    return true;
  end if;

  if v_count >= p_limit then
    return false;            -- over the limit → refuse
  end if;

  update public.auth_throttle set count = v_count + 1 where bucket = p_bucket;
  return true;
end;
$$;

-- Clear a bucket after a SUCCESSFUL login so a legit operator who fat-fingered
-- their PIN a few times isn't locked out by their own eventual success.
create or replace function public.clear_login_throttle(p_bucket text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.auth_throttle where bucket = p_bucket;
$$;

-- Lock both down: only the service role (the edge function's secret key) may call.
revoke all on function public.hit_login_throttle(text, integer, integer) from public, anon, authenticated;
revoke all on function public.clear_login_throttle(text) from public, anon, authenticated;
grant execute on function public.hit_login_throttle(text, integer, integer) to service_role;
grant execute on function public.clear_login_throttle(text) to service_role;
