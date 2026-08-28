#!/usr/bin/env bash
#
# From a freshly bought server to a running site.
#
# One command, run once, as root. Everything it does is also in
# docs/deploy-runbook-fa.md as separate steps, so nothing here is a black box —
# this is the same sequence, automated, for the case where nobody wants to type
# it out.
#
#   curl -fsSL https://raw.githubusercontent.com/Sinaaghaahmadi/q/main/deploy/scripts/bootstrap.sh | sudo bash
#
# ...is deliberately NOT the documented way to run it. Piping a URL into a root
# shell means trusting whatever that URL serves at that instant. Clone the
# repository, read this file, then run it.
set -Eeuo pipefail

[[ $EUID -eq 0 ]] || { echo "Run this with sudo." >&2; exit 1; }

REPO="${REPO:-https://github.com/Sinaaghaahmadi/q.git}"
BRANCH="${BRANCH:-main}"
TARGET="${TARGET:-/opt/asaex}"

step() { printf '\n\e[1m▸ %s\e[0m\n' "$1"; }
say()  { printf '  %s\n' "$1"; }

step "Checking what this machine can do"
if [[ -f "$TARGET/deploy/scripts/preflight.sh" ]]; then
  bash "$TARGET/deploy/scripts/preflight.sh" || true
  echo
  read -rp "  Continue? [y/N] " go
  [[ "$go" == "y" || "$go" == "Y" ]] || exit 1
fi

step "Base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git gnupg openssl ufw fail2ban \
                       unattended-upgrades jq >/dev/null
say "installed"

step "Docker"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
fi
systemctl enable --now docker >/dev/null
say "docker $(docker --version | awk '{print $3}' | tr -d ,)"

step "The application"
if [[ -d "$TARGET/.git" ]]; then
  git -C "$TARGET" fetch --depth 1 origin "$BRANCH" && git -C "$TARGET" reset --hard "origin/$BRANCH"
else
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$TARGET"
fi
# The repository holds no secrets, but the .env it will grow does.
chmod 750 "$TARGET"
say "at $TARGET on $BRANCH"

step "Secrets"
if [[ -f "$TARGET/deploy/.env" ]]; then
  say "deploy/.env already exists — leaving it alone"
else
  bash "$TARGET/deploy/scripts/gen-secrets.sh"
fi

step "Hardening"
bash "$TARGET/deploy/scripts/harden.sh"

step "Scheduled jobs"
install -m 0644 "$TARGET"/deploy/systemd/*.service "$TARGET"/deploy/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now asaex-backup.timer asaex-health.timer asaex-restore-drill.timer >/dev/null
mkdir -p /var/lib/asaex /var/backups/asaex
chmod 700 /var/backups/asaex
say "nightly backup, five-minute health check, monthly restore drill"

cat <<'NEXT'

▸ What is left, and only you can do it

  1. Open deploy/.env and fill in three things:
       DOMAIN=            the address customers will type
       ACME_EMAIL=        a mailbox you read, for certificate warnings
       KAVENEGAR_API_KEY= the API key, not your panel password

  2. Point the domain at this machine. In the host's DNS panel, one record:
       Type: A     Name: @     Value: <this machine's address>
     And, if you want www to work too:
       Type: A     Name: www   Value: <the same address>
     Wait until `dig +short yourdomain.com` prints that address.

  3. Then:
       cd /opt/asaex && ./deploy/scripts/deploy.sh

     It builds the app, migrates the database in the right order, starts
     everything, gets a certificate, and checks the site answers.

NEXT
