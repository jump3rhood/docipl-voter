-- Vote-integrity functions. All are SECURITY DEFINER and executable only by service_role.
-- Functions returning tables use `#variable_conflict use_column` and alias every table so
-- OUT params (status, team_id, name, ...) never shadow column references.

-- 'open' | 'before' | 'closed'
create or replace function public.voting_state()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.voting_config%rowtype;
begin
  select * into c from public.voting_config vc where vc.id = 1;
  if not found then
    return 'before';
  end if;
  if now() >= c.voting_end then
    return 'closed';
  end if;
  if c.is_enabled and now() >= c.voting_start then
    return 'open';
  end if;
  return 'before';
end;
$$;

-- 'ok' | 'voting_not_open' | 'voting_closed'
create or replace function public.mint_token(
  p_token_hash text,
  p_ip_hash text,
  p_ttl_seconds int default 7200
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state text;
  v_end timestamptz;
begin
  v_state := public.voting_state();
  if v_state = 'before' then
    return 'voting_not_open';
  elsif v_state = 'closed' then
    return 'voting_closed';
  end if;

  select vc.voting_end into v_end from public.voting_config vc where vc.id = 1;

  insert into public.voting_tokens (token_hash, status, expires_at, ip_hash)
  values (
    p_token_hash,
    'active',
    least(now() + make_interval(secs => p_ttl_seconds), v_end),
    p_ip_hash
  );
  return 'ok';
end;
$$;

-- status: ok | voting_not_open | voting_closed | token_invalid | token_used | invalid_team | already_voted
create or replace function public.cast_vote(
  p_token_hash text,
  p_team_id uuid,
  p_browser_id_hash text,
  p_device_hash text,
  p_ip_hash text,
  p_user_agent_hash text
)
returns table (status text, team_id uuid, team_name text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_state text;
  v_token public.voting_tokens%rowtype;
  v_team public.teams%rowtype;
  v_voter_id uuid;
  v_cap int;
  v_count int;
begin
  -- 1. Voting window.
  v_state := public.voting_state();
  if v_state = 'before' then
    return query select 'voting_not_open'::text, null::uuid, null::text;
    return;
  elsif v_state = 'closed' then
    return query select 'voting_closed'::text, null::uuid, null::text;
    return;
  end if;

  -- 2. Token, row-locked so concurrent casts of the same token serialize here.
  select * into v_token
  from public.voting_tokens vt
  where vt.token_hash = p_token_hash
  for update;

  if not found then
    return query select 'token_invalid'::text, null::uuid, null::text;
    return;
  end if;
  if v_token.status = 'used' then
    return query select 'token_used'::text, null::uuid, null::text;
    return;
  end if;
  if v_token.status in ('revoked', 'expired') then
    return query select 'token_invalid'::text, null::uuid, null::text;
    return;
  end if;
  if v_token.expires_at <= now() then
    update public.voting_tokens vt set status = 'expired' where vt.id = v_token.id;
    return query select 'token_invalid'::text, null::uuid, null::text;
    return;
  end if;

  -- 3. Team must exist and be active; token stays active otherwise.
  select * into v_team from public.teams tm where tm.id = p_team_id and tm.is_active;
  if not found then
    return query select 'invalid_team'::text, null::uuid, null::text;
    return;
  end if;

  -- 4. Upsert voter (ON CONFLICT row-locks it, serializing same-browser casts).
  insert into public.voters as vr (browser_id_hash, ip_hash, user_agent_hash)
  values (p_browser_id_hash, p_ip_hash, p_user_agent_hash)
  on conflict (browser_id_hash) do update
    set last_seen_at = now(),
        ip_hash = excluded.ip_hash,
        user_agent_hash = excluded.user_agent_hash
  returning vr.id into v_voter_id;

  -- 5. One vote per browser.
  if exists (select 1 from public.votes v where v.voter_id = v_voter_id) then
    return query select 'already_voted'::text, null::uuid, null::text;
    return;
  end if;

  -- 6. Per (device, ip) cap; 0 disables. Advisory lock makes the count-then-insert exact
  --    under concurrency for the same (device, ip).
  select vc.max_votes_per_device_ip into v_cap from public.voting_config vc where vc.id = 1;
  if coalesce(v_cap, 0) > 0 and p_device_hash is not null and p_ip_hash is not null then
    perform pg_advisory_xact_lock(hashtextextended('cast_vote:' || p_device_hash || ':' || p_ip_hash, 0));
    select count(*) into v_count
    from public.votes v
    where v.device_hash = p_device_hash and v.ip_hash = p_ip_hash;
    if v_count >= v_cap then
      return query select 'already_voted'::text, null::uuid, null::text;
      return;
    end if;
  end if;

  -- 7. Record vote and consume token.
  begin
    insert into public.votes (team_id, voter_id, token_id, device_hash, ip_hash, user_agent_hash)
    values (v_team.id, v_voter_id, v_token.id, p_device_hash, p_ip_hash, p_user_agent_hash);

    update public.voting_tokens vt
    set status = 'used', used_at = now()
    where vt.id = v_token.id;
  exception
    when unique_violation then
      return query select 'already_voted'::text, null::uuid, null::text;
      return;
  end;

  return query select 'ok'::text, v_team.id, v_team.name;
end;
$$;

-- 0 or 1 rows.
create or replace function public.get_voter_vote(p_browser_id_hash text)
returns table (team_id uuid, team_name text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  select tm.id, tm.name
  from public.voters vr
  join public.votes v on v.voter_id = vr.id
  join public.teams tm on tm.id = v.team_id
  where vr.browser_id_hash = p_browser_id_hash;
end;
$$;

-- Fixed-window counter; true while the caller is within p_max hits for the window.
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_key_hash text,
  p_window_seconds int,
  p_max int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count int;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as rl (bucket, key_hash, window_start, count)
  values (p_bucket, p_key_hash, v_window, 1)
  on conflict (bucket, key_hash, window_start) do update
    set count = rl.count + 1
  returning rl.count into v_count;

  if random() < 0.01 then
    delete from public.rate_limits rl where rl.window_start < now() - interval '1 hour';
  end if;

  return v_count <= p_max;
end;
$$;

-- Active teams only (zero-vote teams included). Percent is of votes for active teams.
create or replace function public.get_results()
returns table (
  team_id uuid,
  name text,
  slug text,
  logo_url text,
  accent_color text,
  votes bigint,
  percent numeric,
  rank int
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  with counts as (
    select v.team_id as tid, count(*)::bigint as n
    from public.votes v
    group by v.team_id
  ),
  active as (
    select tm.id, tm.name, tm.slug, tm.logo_url, tm.accent_color, tm.display_order,
           coalesce(c.n, 0)::bigint as n
    from public.teams tm
    left join counts c on c.tid = tm.id
    where tm.is_active
  ),
  tot as (
    select sum(a.n) as total from active a
  )
  select a.id,
         a.name,
         a.slug,
         a.logo_url,
         a.accent_color,
         a.n,
         coalesce(round(100.0 * a.n / nullif(t.total, 0), 1), 0)::numeric,
         (rank() over (order by a.n desc))::int
  from active a
  cross join tot t
  order by a.n desc, a.display_order;
end;
$$;

-- Privileges: service_role only.
revoke execute on function public.voting_state() from public, anon, authenticated;
revoke execute on function public.mint_token(text, text, int) from public, anon, authenticated;
revoke execute on function public.cast_vote(text, uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.get_voter_vote(text) from public, anon, authenticated;
revoke execute on function public.rate_limit_hit(text, text, int, int) from public, anon, authenticated;
revoke execute on function public.get_results() from public, anon, authenticated;

grant execute on function public.voting_state() to service_role;
grant execute on function public.mint_token(text, text, int) to service_role;
grant execute on function public.cast_vote(text, uuid, text, text, text, text) to service_role;
grant execute on function public.get_voter_vote(text) to service_role;
grant execute on function public.rate_limit_hit(text, text, int, int) to service_role;
grant execute on function public.get_results() to service_role;
