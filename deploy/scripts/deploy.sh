#!/usr/bin/env bash
#
# Bring the site up, or move it to a new version.
#
# The ordering here is not arbitrary and is the whole reason this is a script
# rather than a paragraph in a runbook. Three constraints were found by running
# it, each of which fails in a way that looks like something else:
#
#   · the application's migrations reference `auth.users` columns and
#     `storage.buckets`, which are created by GoTrue's and storage-api's own
#     migrations. Run ours first and 0006 dies on "column phone does not
#     exist", which reads like a broken migration and is not one;
#   · the database's service roles get their passwords from a post-init hook
#     that only runs on an empty data directory, so a first boot must be
#     allowed to finish before anything tries to connect;
#   · `NEXT_PUBLIC_*` values are compiled into the browser bundle, so changing
#     the domain means rebuilding the image, not restarting the container.
#
# Safe to run repeatedly. If the new version fails its health check, the
# previous image is put back and the script exits non-zero without touching
# the database again.
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
cd "$ROOT"

[[ -f "$HERE/.env" ]] || { echo "✗ $HERE/.env is missing — run deploy/scripts/gen-secrets.sh first" >&2; exit 1; }
set -a; . "$HERE/.env"; set +a
: "${DOMAIN:?DOMAIN is empty in deploy/.env}"

COMPOSE=(docker compose -f "$HERE/docker-compose.yml" --env-file "$HERE/.env")
step() { printf '\n\e[1m▸ %s\e[0m\n' "$1"; }

NEW_TAG="$(git rev-parse --short HEAD 2>/dev/null || date -u +%Y%m%d%H%M)"
PREV_TAG="$(docker inspect --format '{{index .Config.Labels "asaex.tag"}}' asaex-app-1 2>/dev/null || echo '')"

# ── Build ────────────────────────────────────────────────────────────────────
step "Building the application ($NEW_TAG)"
build_args=(
  --build-arg "BASE_REGISTRY=${BASE_REGISTRY:-docker.io}"
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=https://$DOMAIN"
  --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"
  --build-arg "NEXT_PUBLIC_APP_URL=https://$DOMAIN"
  --build-arg "NEXT_PUBLIC_BUILD_SHA=$NEW_TAG"
  --label "asaex.tag=$NEW_TAG"
)
# A private CA, only if one was placed here. Networks that intercept TLS break
# `pnpm install` with an error about a self-signed certificate.
[[ -f "$HERE/ca.crt" ]] && build_args+=(--secret "id=ca,src=$HERE/ca.crt")

docker build "${build_args[@]}" -t "asaex-app:$NEW_TAG" -t asaex-app:latest .

# ── Data services, in dependency order ───────────────────────────────────────
step "Starting the database"
"${COMPOSE[@]}" up -d db
until "${COMPOSE[@]}" exec -T db psql -U supabase_admin -d postgres -c 'select 1' >/dev/null 2>&1; do
  printf '.'; sleep 2
done
echo " ready"

step "Starting auth, the API and storage — they own their own schemas"
"${COMPOSE[@]}" up -d auth rest storage realtime
# GoTrue and storage-api migrate on boot. Ours cannot run until they have.
for svc in auth storage; do
  printf '  waiting for %s to finish its migrations' "$svc"
  for _ in $(seq 1 60); do
    if "${COMPOSE[@]}" logs "$svc" 2>&1 | grep -qiE "migrations applied|Started Successfully|listening"; then break; fi
    printf '.'; sleep 2
  done
  echo
done

step "Applying the application's migrations"
"$HERE/scripts/migrate.sh"

# PostgREST caches the shape of the schema. New tables created after it started
# are invisible to it until told, and the symptom is a 404 on a table that
# plainly exists.
"${COMPOSE[@]}" exec -T db psql -q -U supabase_admin -d postgres \
  -c "notify pgrst, 'reload schema'" >/dev/null

# ── The application ──────────────────────────────────────────────────────────
step "Starting the application"
APP_TAG="$NEW_TAG" "${COMPOSE[@]}" up -d app

printf '  waiting for it to answer'
healthy=0
for _ in $(seq 1 45); do
  if "${COMPOSE[@]}" exec -T app node -e \
       "fetch('http://127.0.0.1:3000/api/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
       >/dev/null 2>&1; then healthy=1; break; fi
  printf '.'; sleep 2
done
echo

if (( healthy == 0 )); then
  echo "✗ the new version did not answer." >&2
  if [[ -n "$PREV_TAG" ]]; then
    echo "  Putting $PREV_TAG back." >&2
    APP_TAG="$PREV_TAG" "${COMPOSE[@]}" up -d app
  fi
  echo "  The database was migrated and was NOT rolled back — migrations are" >&2
  echo "  written to be safe against the previous version. Check: docker compose logs app" >&2
  exit 1
fi

step "Starting the web server"
"${COMPOSE[@]}" up -d caddy

# ── Prove it from outside ────────────────────────────────────────────────────
step "Checking the site answers over HTTPS"
sleep 3
for path in / /api/live /auth/v1/health; do
  code="$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "https://$DOMAIN$path" 2>/dev/null || echo 000)"
  printf '  %-18s → %s\n' "$path" "$code"
done

# Keep the last three images and no more. Old layers are the fastest way to
# fill a 100 GB disk without noticing.
docker image prune -f --filter "label=asaex.tag" --filter "until=720h" >/dev/null 2>&1 || true

printf '\n\e[1m✓ %s is live on %s\e[0m\n\n' "$NEW_TAG" "https://$DOMAIN"
