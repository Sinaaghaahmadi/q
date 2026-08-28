-- Passwords for the service roles, run after the image has created them.
--
-- The first attempt at this mounted a directory over
-- `/docker-entrypoint-initdb.d`, which is where the image keeps its own
-- migrations — the ones that create `authenticator`, `anon`, `authenticated`,
-- `supabase_auth_admin` and the rest. The mount hid all of them, the database
-- came up with a single role, and every service failed to authenticate against
-- a database that looked healthy. Bind mounts replace; they do not merge.
--
-- `/etc/postgresql.schema.sql` is the hook the image reserves for this exact
-- purpose: its `migrate.sh` runs it last, as `supabase_admin`, after every
-- migration. `migrate.sh` already sets the password for `supabase_admin` and
-- `postgres` itself, so only the three it leaves alone are set here.
--
-- `\getenv` rather than a shelled-out `echo`: the password never becomes a
-- word on a command line, and `format(%L)` quotes it properly so a password
-- containing a quote cannot end the statement early.

\getenv pw POSTGRES_PASSWORD
-- A psql variable cannot be read from inside a DO block, so it is handed over
-- as a session setting. `set_config(..., true)` makes it local to this
-- transaction, so it is gone the moment the file finishes.
select set_config('asaex.pw', :'pw', false);

do $$
declare
  pw text := current_setting('asaex.pw', true);
begin
  if pw is null or pw = '' then
    raise exception 'POSTGRES_PASSWORD was not passed through to post-init';
  end if;
  execute format('alter role supabase_auth_admin    with password %L', pw);
  execute format('alter role supabase_storage_admin with password %L', pw);
  execute format('alter role authenticator          with password %L', pw);
end $$;

-- Realtime keeps its tenants and replication cursors in a schema of its own,
-- and it will not create that schema: `DB_AFTER_CONNECT_QUERY` sets the search
-- path to `_realtime` before the migrator runs, so an absent schema surfaces as
-- "no schema has been selected to create in" — which reads like a permissions
-- problem and is not one.
create schema if not exists _realtime;
alter schema _realtime owner to supabase_admin;
