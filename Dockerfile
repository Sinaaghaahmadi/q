# syntax=docker/dockerfile:1.7

# The Asaex application image.
#
# Three stages, and the reason for each is the same: nothing that is only needed
# to *build* the app should exist in the image that *runs* it. The runtime layer
# has no pnpm, no source, no compilers and no package manager — a smaller attack
# surface, and about a fifth of the size, which matters when the image is built
# on a server in Iran over a link that may be pulling its base layers through a
# mirror.
#
# BASE_REGISTRY exists for exactly that: Docker Hub refuses connections from
# Iranian addresses, so the registry the base image comes from has to be a
# variable rather than a hardcoded `node:22-alpine`. `deploy/scripts/preflight.sh`
# tests the candidates from the server itself and reports which one answers,
# instead of this file guessing.
ARG BASE_REGISTRY=docker.io
ARG NODE_IMAGE=${BASE_REGISTRY}/library/node:22-alpine

# ── deps ─────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN corepack enable
# Only the two files that decide the dependency tree, so this layer is reused
# across every build that does not change a dependency — which is most of them.
COPY package.json pnpm-lock.yaml ./

# An optional private CA, for networks that terminate TLS in the middle.
#
# Not exotic: a mirror fronted by a corporate proxy, or an ISP that intercepts,
# will present a certificate the base image has never heard of and every
# `pnpm install` dies with SELF_SIGNED_CERT_IN_CHAIN. Passed as a build secret
# rather than a COPY so the certificate never becomes a layer, and the whole
# block is a no-op when the secret is absent — which is the normal case.
#
#   docker build --secret id=ca,src=/path/to/ca.crt ...
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    --mount=type=secret,id=ca,required=false,target=/tmp/extra-ca.crt \
    if [ -s /tmp/extra-ca.crt ]; then \
      cat /tmp/extra-ca.crt >> /etc/ssl/certs/ca-certificates.crt; \
      export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt; \
    fi && \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --prefer-offline

# ── build ────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Values inlined into the client bundle at build time rather than read at
# runtime. `NEXT_PUBLIC_*` is not an environment variable to a browser — it is a
# string baked into JavaScript — so the origin the browser will call has to be
# known here, and a rebuild is required to change it. `deploy.sh` passes them.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_BUILD_SHA
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_BUILD_SHA=${NEXT_PUBLIC_BUILD_SHA} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN --mount=type=secret,id=ca,required=false,target=/tmp/extra-ca.crt \
    if [ -s /tmp/extra-ca.crt ]; then \
      cat /tmp/extra-ca.crt >> /etc/ssl/certs/ca-certificates.crt; \
      export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt; \
    fi && \
    pnpm build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# A named account rather than root. Combined with `read_only` and
# `cap_drop: ALL` in the compose file, a process that escapes the Node runtime
# lands as an unprivileged user in a filesystem it cannot write to.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# `standalone` already contains the traced dependencies and the server; the
# other two are the parts Next deliberately leaves out of it.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Liveness, not readiness — `/api/live` touches nothing.
#
# The first version of this asked `/api/health`, which probes the upstream rate
# providers and takes five seconds per provider when they are down. That is
# longer than the healthcheck timeout, so a bad afternoon at tgju marked this
# container unhealthy and Docker restarted an application that was serving
# perfectly well from its cache. Restarting cannot fix somebody else's outage.
HEALTHCHECK --interval=30s --timeout=4s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
