# What to buy, and why

Written for someone who is buying the machine, not administering it. The
shopping list is first; the reasoning is underneath, so you can check it or hand
it to somebody who will.

---

## فهرست خرید — همین را سفارش بدهید

**۱. سرور ابری، داخل ایران**

| مورد       | مقدار                                 |
| ---------- | ------------------------------------- |
| پردازنده   | ۴ هسته (vCPU)                         |
| حافظه      | ۱۶ گیگابایت RAM                       |
| دیسک       | ۱۰۰ گیگابایت NVMe SSD                 |
| سیستم‌عامل | Ubuntu Server 24.04 LTS               |
| آی‌پی      | یک IPv4 ثابت و اختصاصی                |
| ترافیک     | نامحدود یا حداقل ۱ ترابایت در ماه     |
| موقعیت     | دیتاسنتر داخل ایران (تهران یا شهریار) |

**۲. فضای ذخیره‌سازی ابری (Object Storage / S3)** — ۱۰۰ گیگابایت برای شروع.
مدارک احراز هویت و لوگوی صرافی‌ها آنجا می‌رود، نه روی دیسک سرور.

**۳. دامنه** — یک `.ir` و یک `.com` با همان نام.

**۴. سرویس پیامک** — کاوه‌نگار، با یک خط اختصاصی.

**۵. اینماد و ساماندهی** — ثبت‌نام، بعد از اینکه دامنه و سرور آماده شد.

بس است. سرور اختصاصی (Dedicated) نخرید، سرور خارج از ایران نخرید، و پلن
۲ هسته / ۴ گیگ نخرید — دلیل هر سه پایین آمده است.

---

## Where: inside Iran, and this is not a preference

Three separate reasons, each sufficient on its own.

**Vercel cannot serve Iran.** The current deployment runs on Vercel, which runs
on AWS, which blocks countries under US sanctions. Iranian visitors reach it
unreliably or not at all, and that is upstream of anything in this repository —
no configuration fixes it. The same applies to the managed Supabase project the
app currently talks to. Both are excellent for building; neither can be the
thing an Iranian customer opens.

**The regulatory path runs through an Iranian IP.** An Iranian commercial site
needs ساماندهی and, to be trusted and to take payment, نماد اعتماد الکترونیکی
(eNamad). The practical route to both — and to any درگاه پرداخت — is a domain
resolving to an Iranian address on Iranian infrastructure. Starting abroad means
doing the whole move again later, under time pressure, with real customer data
on the machine.

**Latency, and outages.** A server in an Iranian datacentre sits on the National
Information Network: 5–20 ms from an Iranian phone. Frankfurt is 80–150 ms on a
good day and international transit is throttled — during the 2025 and 2026
disruptions it was cut entirely, while domestic traffic kept moving. A
remittance app that stops working exactly when people most need to move money is
worse than no app.

## Size: 4 vCPU / 16 GB, and why not less

The number that decides this is not the traffic. It is what has to run.

Today the app leans on managed Supabase for authentication, the REST layer over
Postgres, realtime, and file storage. On your own server those become the
self-hosted Supabase stack — around ten containers: Postgres, GoTrue (auth),
PostgREST, Realtime, Storage, imgproxy, Kong, and the supporting pieces. Next.js
runs beside them.

| Component                         | Realistic resident memory |
| --------------------------------- | ------------------------- |
| Postgres (with useful buffers)    | 3–4 GB                    |
| PostgREST + GoTrue + Realtime     | 1.5 GB                    |
| Storage + imgproxy                | 1 GB                      |
| Kong                              | 0.5 GB                    |
| Next.js (two workers)             | 1.5–2 GB                  |
| OS, logs, backups, build headroom | 2 GB                      |

That is 10–11 GB before a single customer arrives. Supabase's own guidance calls
4 GB the bare development minimum and 4 vCPU / 16 GB the production figure, and
that matches the arithmetic above. **8 GB would boot and would be slow** — the
first symptom is Postgres losing its cache to the container churn, and every
page in the panels is a database read.

Four cores rather than two: Next.js server-rendering is CPU-bound per request,
and Postgres wants cores of its own for concurrent queries. Two cores means the
dashboard and a customer's rate page compete, and both wait.

100 GB of disk: the database itself stays small for a long time — orders and
ledger entries are rows, not files. The growth is KYC documents, which is why
they belong in object storage rather than on this disk. 100 GB leaves room for
the OS, Docker images, Postgres, and a fortnight of local backups.

## What not to buy

**A dedicated / bare-metal server.** More money for less flexibility. A cloud
instance can be resized in minutes when the load is finally known; a dedicated
box is a contract. Revisit this when there is a year of real traffic to size
against.

**Anything abroad**, for the reasons above. Hetzner is cheaper and better run
than anything in Iran, and it is the wrong answer here.

**The 2 vCPU / 4 GB plan**, however it is marketed. It cannot hold the stack.

**A managed database add-on** on top of the server. The Supabase stack brings
its own Postgres, and two databases is two things to back up.

## Which provider

**ArvanCloud (ابر آروان) — first choice.** It is the only Iranian provider that
sells all four things this project needs on one account and one invoice: cloud
servers, S3-compatible object storage, a CDN, and DDoS protection. Billing is
hourly, so resizing while the load is still unknown costs nothing to try. It has
more than one Iranian region, which is the beginning of a failover story rather
than a promise of one.

**ParsPack (پارس‌پک) — workable alternative.** Usually cheaper, well-regarded
support. You would arrange object storage separately, which is one more account
and one more thing to remember in the backup routine.

Avoid the cheaper reseller VPS shops. The saving is small and what you give up —
snapshots, an S3 endpoint, somebody to call at 2am — is exactly what a financial
service needs.

Prices are not quoted here on purpose: Iranian pricing pages do not answer from
outside Iran, and a figure invented from memory is worse than none. Ask for
"سرور ابری، ۴ هسته، ۱۶ گیگابایت رم، ۱۰۰ گیگابایت NVMe، اوبونتو ۲۴.۰۴" and
compare like with like.

## What happens to the current setup

Nothing is thrown away.

- **Vercel + managed Supabase stay as staging.** That is what they are good at:
  every push builds, and the database there is where a migration is tried before
  it touches production.
- **Production becomes the Iranian server**, running the same repository.
- **The move is a database dump and a change of two environment variables.** The
  app talks to PostgREST and GoTrue over HTTP; self-hosted Supabase serves the
  same API. `NEXT_PUBLIC_SUPABASE_URL` and the publishable key change, and
  nothing in `src/` does.
- **No service-role key exists anywhere in the application** (ADR 0010), and that
  stays true. Self-hosting does not introduce one.
- `pg_cron` (the price-alert scheduler, migration 0029) and TOTP factors
  (migrations 0028 and 0030) are both in the self-hosted images, so neither
  feature changes.

## What I need from you to do it

1. **The server**: its IP address and root SSH access — a password is fine, I
   will replace it with a key and disable password login as the first step.
   Alternatively an ArvanCloud API token, and I create the machine to spec
   myself.
2. **The domain**: the registrar login, or just point the A record at the server
   IP once you have both and tell me the name.
3. **Kavenegar**: API key and the sender line.
4. **One decision**: the exact domain name, and whether `.ir`, `.com`, or both.

With 1 and 2 I can bring the whole thing up — TLS, the Supabase stack, the app,
backups, and the monitoring — without further questions. Numbers 3 and 4 can
arrive later; the SMS provider is already behind an interface and the app runs
in test mode without it.

## Before the first real customer

`docs/launch-checklist.md` is the list that blocks go-live. The two on it that
this document does not cover: rotate the demo staff passwords, and get an
independent penetration test. Neither needs a server to start.
