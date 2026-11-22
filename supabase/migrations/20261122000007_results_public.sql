-- Admin switch: whether voters may see the results. Off by default (admin-only).
alter table public.voting_config
  add column results_public boolean not null default false;
