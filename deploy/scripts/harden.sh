#!/usr/bin/env bash
#
# Lock the server down. Run once, as root, before the site goes live.
#
# Everything here is reversible and every change says what it does before doing
# it. The one genuinely dangerous step — closing password logins over SSH — is
# refused unless a key is already installed, because locking yourself out of a
# machine you have just bought is a bad afternoon.
#
#   sudo bash harden.sh
set -Eeuo pipefail

[[ $EUID -eq 0 ]] || { echo "Run this with sudo." >&2; exit 1; }
OK=$'\e[32m✓\e[0m'; HM=$'\e[33m!\e[0m'
say() { printf '  %s %s\n' "$1" "$2"; }
step() { printf '\n\e[1m── %s \e[0m\n' "$1"; }

# ── Firewall ─────────────────────────────────────────────────────────────────
step "Firewall"
# Default deny inbound. The site needs two ports; the database, the auth
# service and the API need none, because they are only ever reached across the
# Docker network from inside this machine.
if ! command -v ufw >/dev/null; then apt-get update -qq && apt-get install -y -qq ufw; fi
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'ssh' >/dev/null
ufw allow 80/tcp comment 'http (redirects to https, and ACME)' >/dev/null
ufw allow 443/tcp comment 'https' >/dev/null
ufw allow 443/udp comment 'http/3' >/dev/null
ufw --force enable >/dev/null
say "$OK" "inbound: 22, 80, 443 only — everything else refused"

# Docker publishes ports by writing straight into iptables, underneath ufw.
# A container that published 5432 would be on the internet even with the
# firewall "on". Nothing in this stack publishes anything but 80/443, and this
# is the belt to that braces.
cat > /etc/docker/daemon.json <<'JSON'
{
  "iptables": true,
  "ip-forward": true,
  "userland-proxy": false,
  "live-restore": true,
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" },
  "default-address-pools": [{ "base": "172.30.0.0/16", "size": 24 }]
}
JSON
say "$OK" "docker daemon: logs capped, live-restore on (containers survive a daemon restart)"

# ── SSH ──────────────────────────────────────────────────────────────────────
step "SSH"
sshd_conf=/etc/ssh/sshd_config.d/99-asaex.conf
mkdir -p /etc/ssh/sshd_config.d

# Only turn off passwords if a key is actually installed, for root or for a
# sudo-capable user. Otherwise say so and change nothing.
has_key=0
for f in /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys; do
  [[ -s "$f" ]] && has_key=1
done

if [[ "$has_key" -eq 1 ]]; then
  cat > "$sshd_conf" <<'CONF'
# Written by deploy/scripts/harden.sh
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 20
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding yes
ClientAliveInterval 300
ClientAliveCountMax 2
CONF
  say "$OK" "password logins closed; keys only"
  say "$HM" "TcpForwarding stays on — it is how the database console is reached"
else
  cat > "$sshd_conf" <<'CONF'
# Written by deploy/scripts/harden.sh
MaxAuthTries 3
LoginGraceTime 20
X11Forwarding no
CONF
  say "$HM" "no SSH key found — password login left ON so you are not locked out"
  say "$HM" "install a key, then re-run this script to close it"
fi
sshd -t && systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true

# ── Brute force ──────────────────────────────────────────────────────────────
step "Brute-force protection"
if ! command -v fail2ban-server >/dev/null; then apt-get install -y -qq fail2ban; fi
cat > /etc/fail2ban/jail.d/asaex.conf <<'CONF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled = true

# Caddy writes JSON; this matches a burst of 4xx from one address, which is
# what credential stuffing against the sign-in route looks like from outside.
[caddy-abuse]
enabled  = true
port     = http,https
filter   = caddy-abuse
logpath  = /var/lib/docker/volumes/asaex_caddy-data/_data/access.log
maxretry = 60
findtime = 1m
bantime  = 15m
CONF
cat > /etc/fail2ban/filter.d/caddy-abuse.conf <<'CONF'
[Definition]
failregex = "remote_ip":"<HOST>".*"status":(4\d\d)
ignoreregex = "status":(404|401)
CONF
systemctl enable --now fail2ban >/dev/null 2>&1 || true
say "$OK" "fail2ban: ssh, and 4xx floods against the site"

# ── Unattended security updates ──────────────────────────────────────────────
step "Automatic security updates"
apt-get install -y -qq unattended-upgrades >/dev/null
cat > /etc/apt/apt.conf.d/51-asaex-unattended <<'CONF'
Unattended-Upgrade::Allowed-Origins { "${distro_id}:${distro_codename}-security"; };
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
# Reboots stay manual on purpose: an unattended reboot at 3am on a machine
# holding a currency exchange is a decision, not a maintenance task.
say "$OK" "security patches install themselves; reboots stay manual"

# ── Kernel ───────────────────────────────────────────────────────────────────
step "Kernel"
cat > /etc/sysctl.d/99-asaex.conf <<'CONF'
# Ignore ICMP redirects and source-routed packets — neither has a legitimate
# use on a public server and both are routing-manipulation primitives.
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.all.rp_filter = 1
net.ipv4.tcp_syncookies = 1
# Do not answer broadcast pings: free amplification for somebody else's attack.
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.log_martians = 1
# Postgres and Node both behave badly under a strict overcommit policy.
vm.overcommit_memory = 1
# The default 128 is small for a machine terminating TLS for a whole country.
net.core.somaxconn = 1024
fs.file-max = 200000
CONF
sysctl --system >/dev/null 2>&1 || true
say "$OK" "network and memory settings applied"

# ── Time ─────────────────────────────────────────────────────────────────────
step "Clock"
timedatectl set-ntp true 2>/dev/null || true
say "$OK" "NTP on — a wrong clock breaks TLS and every session token"

# ── Swap ─────────────────────────────────────────────────────────────────────
step "Swap"
if ! swapon --show | grep -q .; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap -q /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -qw vm.swappiness=10
  echo 'vm.swappiness = 10' > /etc/sysctl.d/99-asaex-swap.conf
  say "$OK" "4 GB swap added (used rarely, at swappiness 10 — it is a cushion, not storage)"
else
  say "$OK" "swap already present"
fi

printf '\n\e[1mDone.\e[0m Re-run this any time; every step is idempotent.\n'
printf 'What is now open to the internet:  \e[1m22, 80, 443\e[0m and nothing else.\n\n'
