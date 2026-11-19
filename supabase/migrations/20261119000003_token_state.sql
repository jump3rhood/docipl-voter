-- 'active' | 'used' | 'invalid' (missing, revoked, expired, or past expires_at).
create or replace function public.get_token_state(p_token_hash text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_status text;
  v_expires timestamptz;
begin
  select vt.status, vt.expires_at into v_status, v_expires
  from public.voting_tokens vt
  where vt.token_hash = p_token_hash;

  if not found then
    return 'invalid';
  end if;
  if v_status = 'used' then
    return 'used';
  end if;
  if v_status = 'active' and v_expires > now() then
    return 'active';
  end if;
  return 'invalid';
end;
$$;

revoke execute on function public.get_token_state(text) from public, anon, authenticated;
grant execute on function public.get_token_state(text) to service_role;
