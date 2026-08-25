# What runs where, and why

Nine containers on one machine. One of them holds a public port; the rest are
reachable only across a private Docker network and not from the host either.

```
                    the internet
                         │
                    :80  :443
                         │
                  ┌──────▼──────┐
                  │    Caddy    │   TLS, and the only public port
                  └──┬───┬───┬──┘
        /auth/v1/*   │   │   │   everything else
        /rest/v1/*   │   │   └──────────────► app  (Next.js, non-root)
     /storage/v1/*   │   │
    /realtime/v1/*   │   │
                     │   └─► auth ─┐  rest ─┐  storage ─┐  realtime ─┐
                     │              │        │           │            │
                     └──────────────┴────────┴───────────┴────────────┘
                                              │
                                       ┌──────▼──────┐
                                       │  Postgres   │  no published port
                                       └─────────────┘
```

`studio` and `meta` are behind a compose profile and bound to loopback. The
only way to open the database console is an SSH tunnel from a machine that
already holds the server's key.

## Why Supabase is self-hosted

Not a preference — a consequence. Eighty components in this application call
Supabase directly from the browser: sign-in, every row-level-security read, the
order chat's websocket, KYC uploads. If the API stayed on the hosted project in
Paris, an Iranian customer's browser would have to reach Paris for each of
them, and it cannot. The API has to share an origin with the site, so it runs
on the same machine.

Postgres is pinned to **17.6** because that is what the hosted project runs. A
dump taken from 17.6 will not restore into 15.x, and the cutover is not the
moment to discover that.

## Why Caddy and not Kong

Supabase's own compose file puts Kong in front of the four services to route by
path prefix and strip it. A reverse proxy was already needed for TLS, and Caddy
does the same routing in eleven lines:

| the browser calls | reaches             | how                                                        |
| ----------------- | ------------------- | ---------------------------------------------------------- |
| `/auth/v1/*`      | GoTrue `:9999`      | `handle_path` strips the prefix                            |
| `/rest/v1/*`      | PostgREST `:3000`   | same                                                       |
| `/storage/v1/*`   | storage-api `:5000` | same                                                       |
| `/realtime/v1/*`  | Realtime `:4000`    | rewritten onto `/socket/*` — it does not serve at its root |
| anything else     | the app `:3000`     | passed through                                             |

That is one fewer container, one fewer configuration language, and about
200 MB of memory. `handle_path` rather than `handle` is the whole trick:
`handle` does not strip, and every request 404s with a URL that looks perfectly
correct in the network tab.

## What is deliberately not here

**No service-role key in the application.** ADR 0010 said the app holds no key
that bypasses row-level security, and moving the database into the same
building does not change that. `SERVICE_ROLE_KEY` exists — storage-api and the
admin console need it — and it is never passed to the `app` container.

**No email.** GoTrue's email provider is switched off rather than left on with
no mail server behind it. Customers arrive by SMS; staff are provisioned by an
administrator.

**No metrics endpoint on the internet.** Realtime's metrics port is not routed.

**No inbound anything except 80 and 443.** `harden.sh` sets the firewall, and a
CI check fails the build if any service other than the proxy ever binds a
public port — because Docker publishes ports by writing straight into iptables,
underneath the firewall, and a container that published 5432 would be on the
internet with `ufw` reporting "active".

## Ordering, and why it is a script

Three constraints, each found by running it, each failing in a way that looks
like something else:

1. **GoTrue and storage-api migrate on boot, and our migrations depend on
   theirs.** Migration 0006 references `auth.users.phone` and
   `storage.buckets`. Run ours first and it dies on "column phone does not
   exist", which reads like a broken migration and is not one.

2. **Service-role passwords come from a post-init hook that only runs on an
   empty data directory.** The image creates the roles; it cannot know the
   password this deployment generated. The hook is
   `/etc/postgresql.schema.sql` — mounting a directory over
   `/docker-entrypoint-initdb.d` instead hides the image's own migrations, and
   the database comes up with one role out of eight while reporting healthy.

3. **`NEXT_PUBLIC_*` is compiled into the browser bundle.** Changing the domain
   is a rebuild, not a restart.

`deploy.sh` encodes all three, checks the new version answers before pointing
the proxy at it, and puts the previous image back if it does not.

## The trust boundaries

| holds                                   | what it can do                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `deploy/.env` on the server, 0600, root | everything — JWT signing key, database password, backup passphrase                          |
| `SERVICE_ROLE_KEY`                      | bypasses row-level security. Held by storage-api and the console, never by the app          |
| `ANON_KEY`                              | public by design. Compiled into the browser bundle. Grants nothing on its own — RLS decides |
| a signed-in user's JWT                  | exactly what their RLS policies allow, and nothing else                                     |

Verified against the running stack: a stranger holding the anon key reads zero
rows from `profiles`, `orders`, `exchange_offices`, `office_invitations` and
`audit_log`. A signed-in customer reads their own profile and no orders but
their own.

## Where the data lives

| volume         | contents                              | in the backup?                 |
| -------------- | ------------------------------------- | ------------------------------ |
| `db-data`      | everything transactional              | yes, `pg_dump` nightly         |
| `storage-data` | KYC documents, office logos           | yes, separate tarball          |
| `caddy-data`   | TLS certificates and the ACME account | no — regenerated automatically |

Both backups are encrypted with AES-256 and a passphrase from `deploy/.env`.
The dump is verified by counting the table statements in what actually
decrypts, and a monthly timer restores the newest one into a scratch database
and counts what arrived. A backup nobody has ever restored is a hypothesis.
