-- The app talks to the database only as service_role. Earlier migrations relied on
-- Supabase's default grants for that role, which newer hosted projects no longer
-- give on public tables. Grant explicitly so local and hosted behave the same.
-- anon and authenticated stay fully revoked.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
