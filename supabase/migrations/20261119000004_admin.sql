-- Admin: public logo bucket and guarded destructive functions (service_role only).

insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do nothing;

-- 'ok' | 'refused' (refused while voting is enabled)
create or replace function public.admin_reset_votes()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  select vc.is_enabled into v_enabled from public.voting_config vc where vc.id = 1;
  if coalesce(v_enabled, false) then
    return 'refused';
  end if;
  delete from public.votes where true;
  delete from public.voting_tokens where true;
  delete from public.voters where true;
  delete from public.rate_limits where true;
  return 'ok';
end;
$$;

-- Returns the number of votes kept.
create or replace function public.admin_purge_identifiers()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kept int;
begin
  delete from public.voters where true;
  delete from public.voting_tokens where true;
  delete from public.rate_limits where true;
  update public.votes set ip_hash = null, device_hash = null, user_agent_hash = null where true;
  select count(*)::int into v_kept from public.votes;
  return v_kept;
end;
$$;

revoke execute on function public.admin_reset_votes() from public, anon, authenticated;
grant execute on function public.admin_reset_votes() to service_role;
revoke execute on function public.admin_purge_identifiers() from public, anon, authenticated;
grant execute on function public.admin_purge_identifiers() to service_role;
