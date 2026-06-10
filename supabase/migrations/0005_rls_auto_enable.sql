-- ============================================================================
-- 0005 · RLS auto-enable safety net
-- Belt-and-suspenders: an event trigger that auto-enables RLS on any NEW public
-- table, so a future table can never ship RLS-off by accident.
-- (This block originally lived as an uncommitted edit to 0003; promoted to its
-- own migration so the applied history stays immutable.)
-- ============================================================================
create or replace function public.rls_auto_enable()
returns event_trigger language plpgsql security definer set search_path = pg_catalog as $$
declare cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
    if cmd.schema_name = 'public' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception when others then
        raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    end if;
  end loop;
end; $$;

-- not an API-callable function, but lock it down anyway
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();
