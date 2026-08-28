#!/usr/bin/env bash
#
# Put a backup back.
#
# This is the script nobody reads until the worst day, so it asks for
# confirmation in words, says exactly what it is about to destroy, and takes a
# safety copy of the current database first — restoring the wrong archive is a
# way to lose data that a backup system is supposed to prevent.
#
#   ./deploy/scripts/restore.sh                       restore the newest
#   ./deploy/scripts/restore.sh db-20260824T0300Z     restore a named one
#   ./deploy/scripts/restore.sh --list                show what is available
#   ./deploy/scripts/restore.sh --drill               practise, changing nothing
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a; . "$HERE/.env"; set +a
: "${BACKUP_PASSPHRASE:?}"
DEST="${BACKUP_DIR:-/var/backups/asaex}"
COMPOSE=(docker compose -f "$HERE/docker-compose.yml" --env-file "$HERE/.env")

# `find | sort`, not `ls -t`: ls parses its own output badly and this runs as
# root over a directory of archives.
newest_archive() {
  find "$DEST" -maxdepth 1 -name 'db-*.sql.gz.enc' -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn | head -1 | cut -d' ' -f2-
}

decrypt() { openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in "$1"; }

if [[ "${1:-}" == "--list" ]]; then
  printf '\n  %-34s %10s  %s\n' "archive" "size" "taken"
  for f in "$DEST"/db-*.sql.gz.enc; do
    [[ -e "$f" ]] || { echo "  (none)"; break; }
    printf '  %-34s %10s  %s\n' "$(basename "$f")" \
      "$(numfmt --to=iec "$(stat -c%s "$f")")" "$(date -r "$f" '+%Y-%m-%d %H:%M')"
  done
  echo
  exit 0
fi

# ── The drill ────────────────────────────────────────────────────────────────
#
# Restores into a throwaway database beside the real one and counts what
# arrived. A backup nobody has ever restored is a hypothesis; this turns it
# into a fact without risking anything.
if [[ "${1:-}" == "--drill" ]]; then
  archive="$(newest_archive)"
  [[ -n "$archive" ]] || { echo "✗ no backups in $DEST" >&2; exit 1; }
  echo "→ drilling with $(basename "$archive") into a scratch database"
  "${COMPOSE[@]}" exec -T db psql -q -U supabase_admin -d postgres \
    -c "drop database if exists restore_drill" -c "create database restore_drill" >/dev/null
  # `|| true`: a dump full of `drop ... if exists` and role grants will emit
  # errors against an empty scratch database and still restore the data, which
  # is what is being measured.
  decrypt "$archive" | gunzip | "${COMPOSE[@]}" exec -T db psql -q -U supabase_admin -d restore_drill >/dev/null 2>&1 || true
  tables="$("${COMPOSE[@]}" exec -T db psql -tAU supabase_admin -d restore_drill -c \
    "select count(*) from information_schema.tables where table_schema='public'" | tr -d '\r')"
  orders="$("${COMPOSE[@]}" exec -T db psql -tAU supabase_admin -d restore_drill -c \
    "select count(*) from public.orders" 2>/dev/null | tr -d '\r' || echo '?')"
  "${COMPOSE[@]}" exec -T db psql -q -U supabase_admin -d postgres -c "drop database restore_drill" >/dev/null
  echo "  restored $tables tables, $orders orders"
  if [[ "$tables" -gt 20 ]]; then
    echo "✓ the backup is restorable"
  else
    echo "✗ only $tables tables came back — investigate before trusting this" >&2
    exit 1
  fi
  exit 0
fi

# ── The real thing ───────────────────────────────────────────────────────────
name="${1:-}"
if [[ -z "$name" ]]; then
  archive="$(newest_archive)"
else
  archive="$DEST/${name%.sql.gz.enc}.sql.gz.enc"
fi
[[ -f "$archive" ]] || { echo "✗ no such archive: $archive" >&2; exit 1; }
files="${archive/db-/storage-}"; files="${files/.sql.gz.enc/.tar.gz.enc}"

cat <<WARN

  About to replace the live database with:
    $(basename "$archive")   ($(date -r "$archive" '+%Y-%m-%d %H:%M'))

  Everything written since that moment will be gone. The site will be
  offline while this runs.

WARN
read -rp '  Type  restore  to go ahead: ' confirm
[[ "$confirm" == "restore" ]] || { echo "  Nothing was changed."; exit 1; }

echo "→ taking a safety copy of the current database first"
safety="$DEST/before-restore-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
"${COMPOSE[@]}" exec -T db pg_dump -U supabase_admin -d postgres --clean --if-exists --no-owner | gzip -9 > "$safety"
chmod 600 "$safety"
echo "  saved to $safety"

echo "→ stopping everything that writes"
"${COMPOSE[@]}" stop app auth rest storage realtime >/dev/null

echo "→ restoring the database"
decrypt "$archive" | gunzip | "${COMPOSE[@]}" exec -T db psql -q -v ON_ERROR_STOP=0 -U supabase_admin -d postgres >/dev/null

if [[ -f "$files" ]]; then
  echo "→ restoring stored documents"
  decrypt "$files" | gunzip | "${COMPOSE[@]}" exec -T storage tar -xf - -C /var/lib/storage
fi

echo "→ starting everything again"
"${COMPOSE[@]}" up -d
sleep 5
"${COMPOSE[@]}" exec -T db psql -q -U supabase_admin -d postgres -c "notify pgrst, 'reload schema'" >/dev/null

echo
echo "✓ restored. Check the site, then check an order you know should exist."
echo "  If this restore was wrong, $safety is the database as it was."
