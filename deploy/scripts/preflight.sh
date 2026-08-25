#!/usr/bin/env bash
#
# Run this on the new server, first, before anything else.
#
# It changes nothing. It looks at the machine and at what the machine can
# reach, and prints a report — which you can paste back verbatim. That report
# is how a deployment gets planned without anybody logging in to poke around:
# every question that would otherwise be "try it and see" is answered here, at
# once, from the only vantage point that can answer it.
#
# It is deliberately paranoid about Docker Hub. Hub refuses connections from
# Iranian addresses, and a build that discovers this halfway through is a build
# that leaves the machine in a half-configured state. So the mirrors are tested
# here and the winner is written into the configuration, rather than guessed.
#
#   bash preflight.sh
set -uo pipefail   # deliberately not -e: a failing probe is a result, not a stop

BOLD=$'\e[1m'; DIM=$'\e[2m'; OK=$'\e[32m'; BAD=$'\e[31m'; WARN=$'\e[33m'; OFF=$'\e[0m'
pass=0; fail=0; warn=0

section() { printf '\n%s── %s %s\n' "$BOLD" "$1" "$OFF"; }
good()    { printf '  %s✓%s %s\n' "$OK" "$OFF" "$1"; pass=$((pass+1)); }
bad()     { printf '  %s✗%s %s\n' "$BAD" "$OFF" "$1"; fail=$((fail+1)); }
note()    { printf '  %s!%s %s\n' "$WARN" "$OFF" "$1"; warn=$((warn+1)); }
info()    { printf '    %s%s%s\n' "$DIM" "$1" "$OFF"; }

# A host is "reachable" if TLS completes and something answers. A 403 counts:
# it means the connection worked and the far end chose to refuse, which is a
# different problem from a blocked route.
probe() {
  local url="$1" label="${2:-$1}" code
  code="$(curl -sS -o /dev/null -m 12 -w '%{http_code}' "$url" 2>/dev/null)"
  if [[ "$code" =~ ^[123] ]]; then good "$label  ($code)"; return 0
  elif [[ "$code" =~ ^[45] ]]; then note "$label  answers but refuses ($code)"; return 1
  else bad "$label  no answer"; return 2; fi
}

printf '%sAsaex — server preflight%s\n' "$BOLD" "$OFF"
printf '%s%s  ·  %s%s\n' "$DIM" "$(date -u '+%Y-%m-%d %H:%M UTC')" "$(hostname)" "$OFF"

# ── The machine ──────────────────────────────────────────────────────────────
section "The machine"
cores="$(nproc 2>/dev/null || echo '?')"
mem_gb="$(awk '/MemTotal/ {printf "%.1f", $2/1048576}' /proc/meminfo 2>/dev/null || echo '?')"
disk_gb="$(df -BG --output=avail / 2>/dev/null | tail -1 | tr -dc '0-9' || echo '?')"

# Written as if/else rather than `A && B || C`: in that idiom C also runs when
# B fails, which turns one wrong answer into two contradictory lines.
if [[ "$cores" != '?' && "$cores" -ge 4 ]]; then good "CPU: $cores cores"
else note "CPU: $cores cores (4 recommended)"; fi

if awk -v m="$mem_gb" 'BEGIN{exit !(m+0 >= 15)}'; then good "RAM: ${mem_gb} GB"
else note "RAM: ${mem_gb} GB (16 recommended; measured ~0.6 GB idle, ~6 GB loaded, and the build is the peak)"; fi

if [[ "$disk_gb" != '?' && "$disk_gb" -ge 60 ]]; then good "Disk free: ${disk_gb} GB"
else note "Disk free: ${disk_gb} GB (100 recommended)"; fi

if [[ -r /etc/os-release ]]; then . /etc/os-release; info "OS: ${PRETTY_NAME:-unknown}"; fi
info "Kernel: $(uname -r)"
info "Architecture: $(uname -m)"
[[ "$(uname -m)" == "x86_64" ]] || note "Not x86_64 — some pinned images have no build for this architecture"

# Swap matters here: Postgres and Node both behave far better with a little
# swap than with none when memory spikes during a build.
swap_mb="$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)"
if [[ "${swap_mb:-0}" -ge 2048 ]]; then good "Swap: ${swap_mb} MB"
else note "Swap: ${swap_mb} MB (2048+ recommended; harden.sh adds it)"; fi

# ── Software ─────────────────────────────────────────────────────────────────
section "Software"
if command -v docker >/dev/null 2>&1; then
  good "docker $(docker --version | awk '{print $3}' | tr -d ,)"
  if docker info >/dev/null 2>&1; then good "docker daemon responds"; else bad "docker daemon not running or not permitted for this user"; fi
  if docker compose version >/dev/null 2>&1; then good "docker compose $(docker compose version --short 2>/dev/null)"; else bad "docker compose v2 plugin missing"; fi
else
  note "docker not installed (bootstrap.sh installs it)"
fi
for c in git curl openssl; do
  if command -v "$c" >/dev/null 2>&1; then good "$c present"; else bad "$c missing"; fi
done

# ── Ports ────────────────────────────────────────────────────────────────────
section "Ports that must be free"
for p in 80 443; do
  if command -v ss >/dev/null 2>&1 && ss -lntH "sport = :$p" 2>/dev/null | grep -q .; then
    bad "port $p is already in use — something else is serving here"
    info "$(ss -lntpH "sport = :$p" 2>/dev/null | head -1)"
  else
    good "port $p free"
  fi
done

# ── What this machine can reach ──────────────────────────────────────────────
section "Outbound: things the build needs"
probe https://github.com                "github.com  (the source)"
probe https://registry.npmjs.org        "registry.npmjs.org  (packages)"

section "Outbound: container registries"
printf '  %sDocker Hub refuses Iranian addresses. One of these must answer.%s\n' "$DIM" "$OFF"
registry_ok=""
for reg in \
  "docker.io|https://registry-1.docker.io/v2/" \
  "docker.arvancloud.ir|https://docker.arvancloud.ir/v2/" \
  "registry.docker.ir|https://registry.docker.ir/v2/" \
  "docker.iranserver.com|https://docker.iranserver.com/v2/" \
  "hub.hamdocker.ir|https://hub.hamdocker.ir/v2/" ; do
  name="${reg%%|*}"; url="${reg##*|}"
  code="$(curl -sS -o /dev/null -m 12 -w '%{http_code}' "$url" 2>/dev/null)"
  # A registry answering 401 is a registry that works — /v2/ demands a token.
  if [[ "$code" == "401" || "$code" =~ ^[23] ]]; then
    good "$name  ($code)"
    [[ -z "$registry_ok" ]] && registry_ok="$name"
  else
    bad "$name  ($code)"
  fi
done
if [[ -n "$registry_ok" ]]; then
  info "→ put  BASE_REGISTRY=$registry_ok  in deploy/.env"
else
  note "No registry answered. Images will have to be carried in by hand — say so and a tarball route will be used instead."
fi

section "Outbound: things the running site needs"
probe https://api.tgju.org              "api.tgju.org  (currency rates)"
probe https://api.kavenegar.com         "api.kavenegar.com  (SMS)"
probe https://acme-v02.api.letsencrypt.org/directory "letsencrypt.org  (TLS certificate)"

section "Inbound: can the world reach this machine?"
ip4="$(curl -sS -m 12 https://api.ipify.org 2>/dev/null || echo '')"
if [[ -n "$ip4" ]]; then
  good "public address: $ip4"
  info "Point the domain's A record at exactly this."
else
  note "could not determine the public address from here"
fi

# ── Time ─────────────────────────────────────────────────────────────────────
section "Clock"
# A clock more than a few minutes out breaks TLS certificate validation and
# makes every JWT either not-yet-valid or already expired.
if command -v timedatectl >/dev/null 2>&1; then
  sync="$(timedatectl show -p NTPSynchronized --value 2>/dev/null || echo no)"
  if [[ "$sync" == "yes" ]]; then good "clock synchronised"
  else note "clock not synchronised — harden.sh enables NTP"; fi
  info "$(timedatectl 2>/dev/null | sed -n '1,3p' | tr '\n' ' ')"
else
  info "$(date -u)"
fi

# ── Verdict ──────────────────────────────────────────────────────────────────
printf '\n%s── Result %s\n' "$BOLD" "$OFF"
printf '  %s%d passed%s   %s%d to look at%s   %s%d blocked%s\n' \
  "$OK" "$pass" "$OFF" "$WARN" "$warn" "$OFF" "$BAD" "$fail" "$OFF"
printf '\n  %sCopy everything above and send it back. Nothing here is secret:%s\n' "$DIM" "$OFF"
printf '  %sit contains no passwords, no keys and no customer data.%s\n\n' "$DIM" "$OFF"
