create extension if not exists pgcrypto;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  accent_color text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.voting_config (
  id int primary key default 1 check (id = 1),
  voting_start timestamptz not null,
  voting_end timestamptz not null check (voting_end > voting_start),
  is_enabled boolean not null default false,
  max_votes_per_device_ip int not null default 3,
  updated_at timestamptz default now()
);

create table public.voting_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  status text not null default 'active' check (status in ('active','used','expired','revoked')),
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  ip_hash text
);

create table public.voters (
  id uuid primary key default gen_random_uuid(),
  browser_id_hash text unique not null,
  ip_hash text,
  user_agent_hash text,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  voter_id uuid unique references public.voters(id) on delete set null,
  token_id uuid unique references public.voting_tokens(id) on delete set null,
  device_hash text,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz default now()
);
create index votes_device_ip_idx on public.votes (device_hash, ip_hash);

create table public.rate_limits (
  bucket text,
  key_hash text,
  window_start timestamptz,
  count int,
  primary key (bucket, key_hash, window_start)
);

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger teams_set_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
create trigger voting_config_set_updated_at before update on public.voting_config
  for each row execute function public.set_updated_at();
create trigger voters_set_updated_at before update on public.voters
  for each row execute function public.set_updated_at();

-- Lockdown: RLS on, no policies, no privileges for anon/authenticated.
alter table public.teams enable row level security;
alter table public.voting_config enable row level security;
alter table public.voting_tokens enable row level security;
alter table public.voters enable row level security;
alter table public.votes enable row level security;
alter table public.rate_limits enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- Future objects created by the migration role are not auto-granted either.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
