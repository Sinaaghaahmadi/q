#!/usr/bin/env bash
#
# Notice when the site stops answering, and say so by text message.
#
# Uses the Kavenegar account the product already has, because a monitoring
# system that needs its own account and its own bill is a monitoring system
# that gets switched off. It checks from the machine itself, which cannot
# detect the machine being down — that is what an external uptime check is for,
# and `docs/deploy-runbook-fa.md` says to set one up as well. What this catches
# is the far more common case: the machine is fine and one container is not.
#
# It will not text more than once an hour about the same thing. An alert that
# arrives sixty times is an alert that gets muted.
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a; . "$HERE/.env"; set +a
: "${DOMAIN:?}"

STATE="/var/lib/asaex/healthwatch"
mkdir -p "$STATE"
COMPOSE=(docker compose -f "$HERE/docker-compose.yml" --env-file "$HERE/.env")

problems=()

# Is the site answering over the address customers actually use?
code="$(curl -sS -o /dev/null -m 25 -w '%{http_code}' "https://$DOMAIN/api/live" 2>/dev/null || echo 000)"
[[ "$code" == "200" ]] || problems+=("site returns $code")

# Is anything restarting in a loop, or stopped?
while read -r name state; do
  [[ -z "$name" ]] && continue
  case "$state" in
    running) ;;
    *) problems+=("$name is $state") ;;
  esac
done < <("${COMPOSE[@]}" ps --format '{{.Service}} {{.State}}' 2>/dev/null)

# Disk. Postgres stops accepting writes when the volume fills, and the first
# symptom customers see is orders that will not save.
used="$(df --output=pcent / | tail -1 | tr -dc '0-9')"
(( used >= 90 )) && problems+=("disk ${used}% full")

# Has the nightly backup actually been running?
newest="$(find "${BACKUP_DIR:-/var/backups/asaex}" -name 'db-*.enc' -mtime -2 2>/dev/null | head -1)"
[[ -n "$newest" ]] || problems+=("no backup in the last two days")

if (( ${#problems[@]} == 0 )); then
  rm -f "$STATE/last-alert"
  exit 0
fi

message="Asaex: $(IFS='; '; echo "${problems[*]}")"
echo "$message" >&2

# One text an hour, and only if the problem changed or an hour has passed.
signature="$(printf '%s' "$message" | sha256sum | cut -c1-16)"
if [[ -f "$STATE/last-alert" ]]; then
  read -r last_sig last_at < "$STATE/last-alert"
  now="$(date +%s)"
  if [[ "$last_sig" == "$signature" ]] && (( now - last_at < 3600 )); then exit 1; fi
fi
printf '%s %s\n' "$signature" "$(date +%s)" > "$STATE/last-alert"

if [[ -n "${ALERT_PHONE:-}" && -n "${KAVENEGAR_API_KEY:-}" ]]; then
  curl -sS -m 20 --get \
    --data-urlencode "receptor=$ALERT_PHONE" \
    --data-urlencode "message=$message" \
    ${KAVENEGAR_SENDER:+--data-urlencode "sender=$KAVENEGAR_SENDER"} \
    "https://api.kavenegar.com/v1/${KAVENEGAR_API_KEY}/sms/send.json" >/dev/null || true
fi
exit 1
