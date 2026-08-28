#!/usr/bin/env bash
#
# Move the live data out of the hosted Supabase project and into this server.
#
# Run once, at the cutover, with the site already working here on empty tables.
# It takes a dump over the internet from the hosted project and loads it in;
# nothing is deleted at the far end, so the hosted project stays exactly as it
# is and can be gone back to.
#
# Two things need care and are handled here:
#
#   · `auth.users` has to come across or every existing account stops
#     existing — including the staff accounts that open the panels. It is
#     dumped separately because the hosted project will not let anyone dump the
#     whole `auth` schema, only its tables.
#   · Passwords survive. They are bcrypt hashes in `auth.users.encrypted_
#     password` and mean nothing without the JWT secret — which is why the
#     secret is *not* copied across: sessions are invalidated on purpose, so
#     everyone signs in once more with the password they already have.
#
#   SOURCE_DB_URL='postgres://...' ./deploy/scripts/migrate-from-supabase.sh
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a; . "$HERE/.env"; set +a
COMPOSE=(docker compose -f "$HERE/docker-compose.yml" --env-file "$HERE/.env")

# No apostrophe in that message on purpose: inside ${VAR:?word} a lone
# quote opens a quoting context and bash then reads the rest of the file
# looking for its partner, reporting "unexpected EOF" a hundred lines later.
: "${SOURCE_DB_URL:?Set SOURCE_DB_URL to the connection string of the hosted project}"

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
chmod 700 "$WORK"

echo "→ checking the far end is reachable and is the version we expect"
remote_version="$("${COMPOSE[@]}" exec -T db psql "$SOURCE_DB_URL" -tAc "show server_version_num" | tr -d '\r')"
local_version="$("${COMPOSE[@]}" exec -T db psql -U supabase_admin -d postgres -tAc "show server_version_num" | tr -d '\r')"
echo "  source $remote_version → target $local_version"
# A dump from a newer server will not load into an older one. Same major is the
# rule; this compares the first two digits.
if [[ "${remote_version:0:2}" != "${local_version:0:2}" ]]; then
  echo "✗ major versions differ. Pin supabase/postgres in docker-compose.yml to match the source." >&2
  exit 1
fi

echo "→ counting what is there now, so the result can be checked"
"${COMPOSE[@]}" exec -T db psql "$SOURCE_DB_URL" -tAc "
  select 'auth.users=' || (select count(*) from auth.users)
      || ' profiles='  || (select count(*) from public.profiles)
      || ' offices='   || (select count(*) from public.exchange_offices)
      || ' orders='    || (select count(*) from public.orders)" | sed 's/^/  source: /'

echo "→ dumping the accounts"
# Only the tables, and only data: the target's own GoTrue has already built the
# schema, and its version may differ from the source's.
"${COMPOSE[@]}" exec -T db pg_dump "$SOURCE_DB_URL" \
  --data-only --no-owner --disable-triggers \
  --table 'auth.users' --table 'auth.identities' \
  --table 'auth.mfa_factors' --table 'auth.mfa_challenges' \
  > "$WORK/auth.sql"

echo "→ dumping the application data"
"${COMPOSE[@]}" exec -T db pg_dump "$SOURCE_DB_URL" \
  --data-only --no-owner --disable-triggers --schema public \
  --exclude-table 'public.schema_migrations' \
  > "$WORK/public.sql"

echo "→ dumping stored documents' metadata"
"${COMPOSE[@]}" exec -T db pg_dump "$SOURCE_DB_URL" \
  --data-only --no-owner --disable-triggers \
  --table 'storage.buckets' --table 'storage.objects' \
  > "$WORK/storage.sql" || echo "  (none, or not permitted — continuing)"

echo "→ loading, in one transaction"
# All three together: a half-loaded database with users but no profiles is
# worse than one that never started.
cat "$WORK/auth.sql" "$WORK/public.sql" "$WORK/storage.sql" 2>/dev/null \
  | "${COMPOSE[@]}" exec -T db psql -v ON_ERROR_STOP=1 --single-transaction -U supabase_admin -d postgres -q

echo "→ counting what arrived"
"${COMPOSE[@]}" exec -T db psql -U supabase_admin -d postgres -tAc "
  select 'auth.users=' || (select count(*) from auth.users)
      || ' profiles='  || (select count(*) from public.profiles)
      || ' offices='   || (select count(*) from public.exchange_offices)
      || ' orders='    || (select count(*) from public.orders)" | sed 's/^/  target: /'

"${COMPOSE[@]}" exec -T db psql -q -U supabase_admin -d postgres -c "notify pgrst, 'reload schema'" >/dev/null

cat <<'AFTER'

✓ Loaded. Now, before telling anyone the site has moved:

  · the two counts above must match;
  · sign in as a staff account and open both panels;
  · open one existing order and check its timeline is complete;
  · the KYC document files themselves are NOT copied by this script — the
    rows that point at them are. Copy the storage bucket separately, or accept
    that old documents will 404 until re-uploaded.

  Everyone will have to sign in again. Their passwords still work; it is the
  session tokens that do not, because this server signs with a different key —
  which is deliberate.

AFTER
