#!/usr/bin/env bash
#
# A nightly backup that is encrypted, verified, and pruned.
#
# Three properties, because a backup missing any of them is decoration:
#
#   · encrypted — the dump contains national codes, passport images' metadata
#     and every settlement account on the platform. An unencrypted copy on the
#     same disk is a second copy of the breach.
#   · verified — the archive is read back and its structure checked before the
#     old ones are pruned. A backup nobody has ever opened is a hypothesis.
#   · pruned — with a floor. If verification fails, nothing old is deleted, on
#     the reasoning that yesterday's good backup beats today's broken one.
#
# Storage objects (KYC documents) are backed up too, as a separate tarball,
# because they live on the filesystem rather than in Postgres.
#
#   ./deploy/scripts/backup.sh
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a; . "$HERE/.env"; set +a
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set in deploy/.env}"

DEST="${BACKUP_DIR:-/var/backups/asaex}"
KEEP="${BACKUP_KEEP_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
COMPOSE=(docker compose -f "$HERE/docker-compose.yml" --env-file "$HERE/.env")

mkdir -p "$DEST"
chmod 700 "$DEST"

db_file="$DEST/db-$STAMP.sql.gz.enc"
files_file="$DEST/storage-$STAMP.tar.gz.enc"

# ── Database ─────────────────────────────────────────────────────────────────
#
# `--clean --if-exists` so the dump can be restored over a database that
# already has objects, which is what a real restore looks like. Roles are
# dumped separately by pg_dumpall; without them a restore lands with no
# `authenticator` and nothing can connect.
echo "→ dumping database"
"${COMPOSE[@]}" exec -T db pg_dumpall --roles-only -U supabase_admin > "$DEST/.roles-$STAMP.sql"
"${COMPOSE[@]}" exec -T db pg_dump \
    -U supabase_admin -d postgres \
    --clean --if-exists --no-owner --quote-all-identifiers \
  | cat "$DEST/.roles-$STAMP.sql" - \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_PASSPHRASE \
  > "$db_file"
rm -f "$DEST/.roles-$STAMP.sql"

# ── Uploaded files ───────────────────────────────────────────────────────────
echo "→ archiving stored documents"
"${COMPOSE[@]}" exec -T storage tar -cf - -C /var/lib/storage . 2>/dev/null \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_PASSPHRASE \
  > "$files_file"

chmod 600 "$db_file" "$files_file"

# ── Verify, before anything old is removed ───────────────────────────────────
echo "→ verifying"
verify_ok=1

# Decrypt, decompress, and count the statements a real dump must contain.
#
# `grep -c`, not `grep -q`. Under `set -o pipefail` a `grep -q` exits the moment
# it finds its first match, which closes the pipe, which kills `gunzip` with
# SIGPIPE, which makes the whole pipeline return 141 — and the check reports a
# perfectly good backup as corrupt. That happened here: 142 matching lines in
# an archive this said was unreadable. Counting reads to the end, so nothing is
# killed and the number is also more useful than a yes.
statements="$(
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in "$db_file" \
    | gunzip \
    | grep -cE 'CREATE TABLE|COPY "public"' || true
)"
if (( statements < 20 )); then
  echo "  ✗ only $statements table statements in the archive — that is not a full dump" >&2
  verify_ok=0
fi

if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in "$files_file" \
     | gunzip | tar -tf - >/dev/null 2>&1; then
  echo "  ✗ the document archive is not a readable tar" >&2
  verify_ok=0
fi

db_size=$(stat -c%s "$db_file")
# A dump smaller than this is an error message, not a database.
if (( db_size < 20000 )); then
  echo "  ✗ the database archive is only ${db_size} bytes" >&2
  verify_ok=0
fi

if (( verify_ok == 0 )); then
  echo "✗ verification failed — keeping every existing backup and this one for inspection" >&2
  exit 1
fi

echo "  ✓ $(numfmt --to=iec "$db_size") database ($statements table statements), $(numfmt --to=iec "$(stat -c%s "$files_file")") documents"

# ── Prune, with a floor ──────────────────────────────────────────────────────
#
# Never go below three, whatever the retention says. A misconfigured
# BACKUP_KEEP_DAYS should not be able to empty the backup directory.
prune() {
  local pattern="$1" keep_min=3
  mapfile -t files < <(find "$DEST" -name "$pattern" -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2-)
  local i=0
  for f in "${files[@]}"; do
    i=$((i+1))
    (( i <= keep_min )) && continue
    if [[ -n "$(find "$f" -mtime "+$KEEP" 2>/dev/null)" ]]; then rm -f "$f"; fi
  done
}
prune 'db-*.sql.gz.enc'
prune 'storage-*.tar.gz.enc'

echo "✓ $STAMP  ($(find "$DEST" -name 'db-*.enc' | wc -l) database backups on hand)"
echo
echo "  These are on the same disk as the thing they back up. Copy them off"
echo "  this machine — a disk failure takes both otherwise."
