#!/usr/bin/env bash
#
# Apply every migration in supabase/migrations, in order, exactly once.
#
# The hosted project tracked this with its own table; a self-hosted stack has
# to keep the ledger itself, so this creates `public.schema_migrations` and
# records each file after it succeeds. Each file runs inside a single
# transaction: a migration that fails half way leaves the database exactly as
# it was, rather than in a state no file describes.
#
#   ./deploy/scripts/migrate.sh            apply what is pending
#   ./deploy/scripts/migrate.sh --status   list applied and pending, change nothing
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"
COMPOSE=(docker compose -f "$HERE/docker-compose.yml" --env-file "$HERE/.env")

[[ -d "$MIGRATIONS" ]] || { echo "✗ no migrations directory at $MIGRATIONS" >&2; exit 1; }

psql_run() { "${COMPOSE[@]}" exec -T db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres "$@"; }

psql_run -q -c "
  create table if not exists public.schema_migrations (
    version     text primary key,
    applied_at  timestamptz not null default now(),
    checksum    text not null
  );
  revoke all on public.schema_migrations from anon, authenticated;
" >/dev/null

applied="$(psql_run -tAc 'select version from public.schema_migrations' | tr -d '\r')"

pending=0
for file in "$MIGRATIONS"/*.sql; do
  version="$(basename "$file")"
  sum="$(sha256sum "$file" | cut -c1-16)"

  if grep -qxF "$version" <<<"$applied"; then
    # A file that changed after being applied is a real problem: the database
    # and the repository now disagree and neither knows it. Say so loudly
    # rather than silently skipping.
    recorded="$(psql_run -tAc "select checksum from public.schema_migrations where version = '$version'" | tr -d '\r')"
    if [[ "$recorded" != "$sum" ]]; then
      echo "  ! $version was edited after it was applied ($recorded → $sum)" >&2
    fi
    continue
  fi

  if [[ "${1:-}" == "--status" ]]; then
    echo "  · $version  (pending)"
    pending=$((pending+1))
    continue
  fi

  echo "  → $version"
  # `--single-transaction` is what makes a failure leave nothing behind.
  if ! psql_run --single-transaction -q -f "/dev/stdin" < "$file"; then
    echo "✗ $version failed. Nothing from it was applied." >&2
    exit 1
  fi
  psql_run -q -c "insert into public.schema_migrations (version, checksum) values ('$version', '$sum')" >/dev/null
  pending=$((pending+1))
done

if [[ "${1:-}" == "--status" ]]; then
  echo "  $pending pending"
else
  echo "✓ ${pending} migration(s) applied"
fi
