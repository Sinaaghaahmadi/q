# Asaex — Telegram Playbook

_What Telegram is actually built with, why it feels the way it does, and how
far this codebase can go down the same road. Facts link to sources inline;
claims we could not pin to a primary source are marked (unverified). §3 and
§5 are the parts we act on; §1–2 are the evidence._

## خلاصهٔ مدیریتی

این سند پاسخ به یک پرسش است: تلگرام با چه چیزی ساخته شده که تا این حد «سریع و
روان» حس می‌شود، و آسائکس چه بخشی از آن مسیر را با همین کدبیس می‌تواند طی کند؟
پاسخ کوتاه: تلگرام تقریباً هیچ جزء آماده‌ای مصرف نمی‌کند — در اندروید لیست‌ها و
حباب‌های پیام با کد اختصاصی مستقیماً روی Canvas رسم می‌شوند، در iOS رندر خارج از
نخ اصلی انجام می‌گیرد، کلاینت وب اصلی فریم‌ورک UI خودش (Teact) را دارد و پروتکل شبکهٔ
سفارشی (MTProto) برای چند دیتاسنتر بهینه شده است. اما حس «آنی» بودن بیش از همه
نتیجهٔ معماری local-first است: پیامِ ارسالی بلافاصله ظاهر می‌شود، هیچ صفحه‌ای
خالی باز نمی‌شود و همگام‌سازی بی‌صدا در پس‌زمینه رخ می‌دهد. از این الگوها ۱۴
اصل نام‌گذاری‌شده استخراج شده — از «ارسال خوش‌بینانه» تا «خویشتن‌داری در
طراحی». بخش بزرگی از زیرساخت لازم همین حالا در کد موجود است: framer-motion،
سرویس‌ورکر با کش نرخ‌ها، توکن‌های رنگی سراسری و کانال Realtime چت. موارد جدید
(کش پایدار کوئری‌ها، ژست‌های لمسی، مجازی‌سازی لیست‌ها) در بودجهٔ باندل جا
می‌شوند؛ تنها lottie-web است که بودجه را می‌شکند و کنار گذاشته می‌شود. در
زیرساخت، کارهای شدنی از امروز از کارهایی که به سرور و دامنهٔ اختصاصی نیاز
دارند جدا شده‌اند؛ در توزیع، اپ‌استوری برای ایران وجود ندارد: مسیر داخل کشور
PWA و APK مستقیم و کافه‌بازار و مایکت است و پوستهٔ Capacitor بعداً برای
کریدورهای دیاسپورا می‌آید — بدون بازنویسی، با همین کدبیس و همین بودجه‌ها.

## 1. What Telegram is built with

### 1.1 Clients — custom rendering everywhere

- **Android** — official repo [DrKLO/Telegram](https://github.com/DrKLO/Telegram)
  (GPLv2+, listed as official at [telegram.org/apps](https://telegram.org/apps)):
  a Java UI layer over a large native C/C++ NDK layer;
  [`TMessagesProj/jni`](https://github.com/DrKLO/Telegram/tree/master/TMessagesProj/jni)
  vendors BoringSSL, FFmpeg, SQLite, a custom networking stack (`tgnet`), VoIP
  code, and a native Lottie renderer (`tlottie`, rlottie lineage). List
  surfaces run through a bespoke
  [`RecyclerListView`](https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/ui/Components/RecyclerListView.java)
  (an extended RecyclerView with its own fast-scroll, sections, selection,
  touch handling). Chat rows are not composed from stock widgets:
  [`ChatMessageCell`](https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/ui/Cells/ChatMessageCell.java)
  (~29,500 lines) is a single custom-drawn view — `BaseCell extends ViewGroup`
  with content painted directly on Canvas.
- **iOS** — [Telegram-iOS](https://github.com/TelegramMessenger/Telegram-iOS)
  (GPLv2+): mixed-language, ~70% Swift / ~24% Objective-C/C++ per an
  [independent source-code walkthrough](https://hubo.dev/2020-05-07-source-code-walkthrough-of-telegram-ios-part-1/).
  Ships its own fork of **AsyncDisplayKit** (off-main-thread node rendering)
  and a Telegram-built **Display** UI library, both
  [vendored as first-party modules](https://github.com/TelegramMessenger/Telegram-iOS/tree/master/submodules);
  animated stickers render via an Objective-C++ binding to
  [rlottie, vendored in-repo](https://github.com/TelegramMessenger/Telegram-iOS/tree/master/submodules/rlottie).
- **Desktop** — [tdesktop](https://github.com/telegramdesktop/tdesktop): C++
  with Qt ("Qt 6 and Qt 5.15, slightly patched"), GPLv3 with OpenSSL exception.
- **Web A** ([telegram-tt](https://github.com/Ajaxy/telegram-tt)) —
  TypeScript, "nearly zero dependencies and fully based on its own Teact
  framework (which re-implements React paradigm)"; custom GramJS build for
  MTProto; Web Workers, WebAssembly, PWA.
- **Web K** ([tweb](https://github.com/morethanwords/tweb)) — TypeScript,
  Solid.js for reactive UI, Vite build, service-worker PWA, WebAssembly modules
  (libwebp, opus-recorder); GPLv3; descended from Webogram.

### 1.2 TDLib and MTProto

- [TDLib](https://github.com/tdlib/td) ("Telegram Database library") — a
  cross-platform client-building library in **C++17**, usable "from nearly any
  programming language" (JNI Java bindings, .NET bindings, JSON interface). It
  handles "network implementation details, encryption and local data storage,"
  is fully asynchronous, and keeps an encrypted local database. Used by
  [Telegram's own Bot API server](https://telegram.org/blog/tdlib) ("each
  TDLib instance handles more than 40000 active bots simultaneously" per the
  README) and by Telegram X.
- [MTProto](https://core.telegram.org/mtproto) — Telegram's custom
  client-server protocol, "designed for access to a server API from
  applications running on mobile devices"; three layers (API serialization to
  binary, crypto layer, transport over TCP/HTTP/WebSockets etc.); MTProto 2.0
  since client v4.6, with perfect forward secrecy. The pitch: a "custom data
  protocol, which is open, secure and optimized for work with multiple
  data-centers," enabling multi-connection sessions and re-routing
  ([FAQ](https://telegram.org/faq)).

### 1.3 Animated stickers

- [rlottie](https://github.com/TelegramMessenger/rlottie) — "a platform
  independent standalone c++ library for rendering vector based animations"
  (Bodymovin/Lottie JSON), originally Samsung's; Telegram maintains a fork,
  tdesktop uses the [desktop-app fork](https://github.com/desktop-app/rlottie).
- **.TGS** — the Lottie-based sticker format: ~20–30 KB per sticker ("six
  times smaller than the average photo"), 60 fps, lower battery than GIF
  ([Animated Stickers blog](https://telegram.org/blog/animated-stickers)).

### 1.4 Open source vs closed

- Every official client — Android, iOS, Desktop,
  [macOS (Swift)](https://github.com/overtake/TelegramSwift), Web A, Web K —
  plus TDLib and the rlottie fork is open source with reproducible builds
  ([list with licenses](https://telegram.org/apps)); the protocol and API are
  [fully documented](https://core.telegram.org/mtproto).
- The server side has never been published: "Telegram's server-side software
  is closed-source and proprietary"
  ([Wikipedia](<https://en.wikipedia.org/wiki/Telegram_(software)>)).
  Telegram's stated rationale: "there's no way to verify that the same code is
  run on the servers," so publishing it adds no security guarantee
  ([FAQ](https://telegram.org/faq)).
- The server implementation language is not officially disclosed. Secondary
  sources commonly attribute a C++ backend built around Nikolai Durov's
  MTProto design, but **this is reported, not confirmed** by any primary
  Telegram source. Durov has said connecting independent servers would require
  "a major architectural redesign" of the server software.

### 1.5 Infrastructure behind the "fast"

- Distributed multi-DC design: "Cloud chat data is stored in multiple data
  centers around the globe controlled by different legal entities across
  different jurisdictions" ([FAQ](https://telegram.org/faq)); MTProto is
  explicitly optimized for multiple data-centers.
- Five core DCs observed via the API config — DC1/DC3 Miami, DC2/DC4
  Amsterdam, DC5 Singapore — with accounts pinned to a home DC at
  registration. Not an official Telegram publication; sourced from
  [developer docs](https://docs.pyrogram.org/faq/what-are-the-ip-addresses-of-telegram-data-centers)
  and [independent research](https://dev.moe/en/3025).
- [Media CDN](https://core.telegram.org/cdn): for public channels >100k
  subscribers, popular files are pushed to CDN DCs in high-traffic regions
  Telegram won't place trusted servers in; files are AES-256-CTR encrypted
  (the CDN "can't access the data"), integrity-checked by SHA-256 on the
  client, and held **in RAM only** with LRU eviction.
- Aggressive client-side caching: TDLib and the apps keep an encrypted local
  store of messages/media; the apps expose per-chat cache controls,
  max-cache-size limits, and auto-remove timers because cached media is
  retained locally by default and can always be re-fetched from the cloud
  ([FAQ](https://telegram.org/faq),
  [storage-settings walkthrough](https://intentchat.app/blog/en-US/telegram-0019-telegram-storage-settings)).
- Net effect: a custom binary protocol with re-routing, home-DC +
  regional-CDN topology, in-memory CDN serving, and canvas-level custom UI on
  every platform produce the perceived instant-open, instant-scroll behavior.

## 2. The anatomy of the feel — 14 principles

1. **Optimistic send, honest receipts** — a sent message appears instantly
   with a small clock icon, then upgrades to one check ("delivered to the
   Telegram cloud") and two checks ("message read")
   ([FAQ](https://telegram.org/faq)). The message renders locally before
   server confirmation; state icons truthfully reflect the pipeline instead of
   blocking it. The pre-ack clock state is observable in-app but not
   documented in the FAQ (unverified).
2. **Never-blank, local-first screens** — reopening the app shows content
   immediately, even offline, with sync catching up silently across devices
   ([FAQ](https://telegram.org/faq)). [TDLib](https://core.telegram.org/tdlib)
   is "fully-asynchronous," handles "local data storage," guarantees update
   ordering, and stays "stable on slow and unreliable Internet connections" —
   cache-first, the network as a background detail.
3. **Sixty-fps expressiveness** — .TGS stickers play at "smooth 60 frames per
   second" at 20–30 KB, using "less battery" than GIFs ([blog](https://telegram.org/blog/animated-stickers));
   rendered natively via the rlottie fork (unverified from the blog itself).
4. **The canvas reacts to you** — gradient wallpapers are "generated
   algorithmically and move beautifully every time you send a message,"
   "smooth, energy-efficient" ([blog](https://telegram.org/blog/animated-backgrounds/))
   — ambient feedback keyed to the single most frequent user act.
5. **Theming as identity** — cloud themes with a color wheel, where "each
   theme has a sharing link which allows anyone to switch to your theme and
   wallpaper in just two taps"
   ([blog](https://telegram.org/blog/scheduled-reminders-themes)); 8 per-chat
   themes with automatic day/night variants
   ([blog](https://telegram.org/blog/chat-themes-interactive-emoji-read-receipts))
   — shareable cloud objects, not local settings.
6. **Gesture economy** — swipe left on a message to reply
   ([Telegram Tips](https://telegram.tips/blog/swipe-left-to-reply/)), swipe a
   chat to archive ([blog](https://telegram.org/blog/archive-and-new-design)),
   swipe between folder tabs ([blog](https://telegram.org/blog/folders)),
   pull up at a channel's end to jump to the next
   ([60fps.design](https://60fps.design/apps/telegram)) — high-frequency
   actions on the content itself, not in toolbars.
7. **Long-press depth** — "hold the 'Send' button in any chat and select
   'Schedule Message'" ([blog](https://telegram.org/blog/scheduled-reminders-themes));
   the same press offers silent sending; long-press reveals secondary actions
   throughout ([Createbytes teardown](https://createbytes.com/insights/telegram-ui-ux-review-design-analysis)).
8. **Folders, not filing cabinets** — Chat Folders are saved server-side
   filters rendered as swipeable tabs, with smart filters, unlimited pins per
   folder, and sync "to all your other connected apps"
   ([blog](https://telegram.org/blog/folders)); one chat can live in many
   folders.
9. **Search without dead ends** — chat-list search spans every chat, with
   filters for private chats / groups / channels and tabs for downloads,
   media, discovery ([blog](https://telegram.org/blog/collectible-gifts-and-more), building on [2020 filters](https://telegram.org/blog/filters-anonymous-admins-comments)).
   Perceived instant-as-you-type speed is observable but not benchmarked by
   Telegram (unverified).
10. **Zero-pageload reading** — Instant View "immediately shows a native
    page, saving you time and data" with "zero pageload time"
    ([blog](https://telegram.org/blog/instant-view)): articles pre-parsed
    server-side into a native template.
11. **Wayfinding in the infinite scroll** — tapping a quoted reply highlights
    and scrolls to the original
    ([Telegram Tips](https://telegram.tips/blog/swipe-left-to-reply/)); a
    floating date pill while scrolling and a scroll-to-bottom button with
    unread count are observable in-app (unverified via primary source).
12. **Functional delight in micro-interactions** — interactive storage pie
    chart, a purpose-built clear-cache animation, confirming toasts, video
    speed sliders — catalogued in the
    [60fps.design teardown](https://60fps.design/apps/telegram) (e.g.
    [clear-cache](https://60fps.design/shots/telegram-clear-cache-animation));
    "lightweight Lottie files for state transitions… without the performance
    tax of heavy video"
    ([turumburum](https://turumburum.com/blog/telegram-mini-app-beyond-the-standard-ui-designing-a-truly-native-experience)).
13. **Synchronized, shared delight** — interactive emoji trigger fullscreen
    effects, and "the animations and vibrations play simultaneously on your
    devices, so you feel close even when you're far apart"
    ([blog](https://telegram.org/blog/chat-themes-interactive-emoji-read-receipts)).
14. **Restraint — content-first chrome** — near-monochrome palette, "generous
    use of white space… a strategic tool to reduce clutter," minimal toolbars
    ([Createbytes](https://createbytes.com/insights/telegram-ui-ux-review-design-analysis),
    [blog](https://telegram.org/blog/archive-and-new-design)). The decoration
    budget is spent on user content, not app chrome.

_Verification notes: radial media-download spinners, the pre-ack clock,
floating date pills, and scroll-to-bottom affordances are observable in-app
but have no primary announcement (unverified). Custom 60fps list rendering
and interruptible springs are widely attributed but not confirmed by a primary
source (unverified); the verified adjacent facts are TDLib's async local-first
design and the 60fps TGS format._

## 3. Mapping to Asaex — exists vs to build

Per pattern: what exists, what to add, where the budget bites.

- **Optimistic UI** — Exists: `@tanstack/react-query` v5 installed
  (`src/components/layout/providers.tsx`) but only for _queries_
  (`src/lib/hooks/use-rates.ts`); mutations are manual `fetch`+`setState`
  (`conversation.tsx` `send()`, `accounts-manager.tsx`). Build: `useMutation`
  with `onMutate` snapshot/rollback; chat already dedupes by id on Realtime
  INSERT (`prev.some(m => m.id === row.id)`) so a locally-appended pending
  bubble reconciles for free. No new dep.
- **Never-blank cached content** — Exists: app-shell precache + NetworkFirst
  `/api/rates` (`src/app/sw.ts`), skeletons (`src/components/ui/skeleton.tsx`),
  ISR home rates (ADR 0009), staleness bannered honestly (ADR 0005). Build:
  `@tanstack/react-query-persist-client` + IndexedDB persister so orders/chat/
  offer lists render last-known instantly; `placeholderData: keepPreviousData`
  on paginated queries. Small (~3 kB gz), safe for the signed-in budget.
- **60fps interruptible springs** — Exists: framer-motion 12; springs are
  interruptible by default (velocity-preserving) — `template.tsx` (200 ms
  directional fade, RTL-aware, reduced-motion), `ui/rolling-number.tsx`
  (AnimatePresence digits), `design/motion-lab.tsx`, `home/converter.tsx`.
  Build: swap tweens for `type:"spring"` with `visualDuration`/`bounce`; add
  `layout` animations to lists. No dep.
- **Swipe gestures** — Exists: nothing. Build: framer-motion `drag`/`onPan`
  (already in the bundle) — reply-swipe on chat bubbles and drag-to-dismiss
  sheets are safe; _back_-swipe should defer to the browser/iOS edge gesture
  and only be implemented in a future Capacitor shell (§6). Must mirror
  direction for fa RTL.
- **Bottom sheets** — Exists: `src/components/ui/dialog.tsx` `DialogContent
variant="sheet"` (Radix; sheet below `sm`, modal above), used in
  `home/currency-picker.tsx`, `rates/rates-view.tsx`,
  `accounts/accounts-manager.tsx`, `admin/kyc-queue.tsx`. Build:
  framer-motion drag-to-dismiss + snap points layered on the existing
  component; skip `vaul` (redundant dep).
- **Radial/segmented progress** — Exists: `ui/countdown-ring.tsx`
  (stroke-dashoffset rate-lock ring, amber pulse <60 s),
  `kyc/progress-rail.tsx`, `ui/segmented.tsx`. Build: reuse the ring for KYC
  upload progress (`kyc/upload-tile.tsx`).
- **Theming engine** — Exists: next-themes light/dark, ~20 semantic tokens in
  `src/styles/globals.css` (`:root`/`.dark` → `@theme inline` — every color
  already flows through CSS vars). Telegram-grade adds: user-picked accent
  (derive brand-50/600/700 in OKLCH), chat wallpaper, per-surface tint —
  implemented as `data-theme`/inline `style` vars on `<html>` persisted to the
  profile; CSP already allows inline styles (`next.config.ts`
  `style-src 'unsafe-inline'`). No lib.
- **Animated icons** — Exists: the hand-built SVG motion system
  `src/components/brand/{coin,logo,scene,scenes}.tsx` (ADR 0013 — deliberately
  Lottie-class without the runtime). Budget caution: lottie-web is ~65 kB gz
  and rlottie needs WASM — both would blow the 215 kB front-door budget. Stay
  hand-built; extend the same idiom to micro-icons (send, check, bell).
- **List virtualization** — Exists: none; `admin/order-table.tsx`,
  `p2p/offer-board.tsx`, `chat/conversation.tsx` render full arrays. Build:
  `@tanstack/react-virtual` (~5 kB gz) for admin tables + chat history; fits
  the 290 kB signed-in budget, keep it off `/`, `/rates`, `/p2p` (215 kB).
- **Floating headers / scroll-to-bottom pill** — Exists: sticky blurred header
  (`layout/header.tsx` line 32), chat autoscroll via `endRef.scrollIntoView`
  (`conversation.tsx`). Build: IntersectionObserver sentinel → animated pill
  with unread count; sticky date chips in chat (pure CSS); CSS scroll-driven
  animations for header condensation as progressive enhancement only (no
  Firefox; Safari 26+).
- **Haptics** — Exists: nothing. Web reality: `navigator.vibrate` is Android
  Chrome only; iOS Safari has **no** Vibration API (only the iOS 18
  `switch`-checkbox toggle hack). Build: a tiny `haptics()` util in `src/lib/`
  that feature-detects and no-ops; real iOS haptics only via
  `@capacitor/haptics` in the shell (§5, §6).
- **Instant search** — Exists: client filter in `home/currency-picker.tsx`
  only. Build: in-memory filter over persisted react-query caches for
  orders/customers (zero-latency), plus a Supabase `pg_trgm`/FTS RPC with
  debounce for server-side search (admin users, P2P). No new client dep.
- **View Transitions API** — Build, zero bytes: Next 15 experimental
  `viewTransition` or `document.startViewTransition` for shared-element
  rate-row→detail and tab switches; degrade to the existing `template.tsx`
  fade. Chrome/Edge/Safari 18+; Firefox ships v144+.

**Budget flags** (`scripts/check-budget.mjs`: gzip first-load JS — 215 kB
front door `/`, `/rates`, `/p2p`; 180 kB legal; 290 kB signed-in): lottie-web
fails; framer-motion is already paid for; react-virtual + persist-client pass
if code-split to signed-in routes; View Transitions + scroll-driven CSS are
free.

## 4. Screen inventory

**44 routes** under `src/app/[locale]` (44 `page.tsx` files):

- **Customer surface (12)** — `/` home: rate strip + converter + brand scenes
  (`src/components/home/{rate-strip,converter,sections}.tsx`, ISR per ADR
  0009); `/rates` rates board with sparkline/history chart + pair-detail
  bottom sheet (`src/components/rates/rates-view.tsx`); `/transfer/new` quote
  → order creation (`src/components/transfer/transfer-quote.tsx`); `/orders`
  list and `/orders/[id]` detail — timeline, actions, chat, cost comparison
  (`src/components/orders/*`); `/accounts` beneficiary CRUD
  (`src/components/accounts/accounts-manager.tsx`); `/p2p` offer board,
  `/p2p/new` composer, `/p2p/[id]` offer detail, `/p2p/trades/[id]` escrowed
  trade workspace (`src/components/p2p/*`); `/profile` profile/security/tier
  (`src/components/auth/{profile-view,tier-referral}.tsx`); `/support` chat
  (reuses `src/components/chat/conversation.tsx`).
- **Office panel (10)** — `/office` today dashboard (big-buttons,
  low-literacy per task 27); `/office/requests` queue; `/office/rates`
  rate-config editor; `/office/accounts`; `/office/customers`; `/office/chat`
  inbox; `/office/liquidity`; `/office/reports`; `/office/team`;
  `/office/settings` (`src/components/office/*`).
- **Admin console (15)** — `/admin` dashboard (stat tiles, audit live-feed,
  volume chart); `/admin/orders` (force-transition); `/admin/exchanges` +
  `/admin/exchanges/[id]` (provisioning wizard/config); `/admin/users` +
  `/admin/users/[id]`; `/admin/kyc` (4-eyes queue); `/admin/rates`;
  `/admin/finance`; `/admin/compliance`; `/admin/audit`; `/admin/content`;
  `/admin/support`; `/admin/settings` (feature flags); `/admin/p2p`
  (moderation) (`src/components/admin/*`).
- **Auth/KYC (2 pages + routes)** — `/signin` (OTP + staff password);
  `/verify` (5-step KYC wizard, `src/components/kyc/wizard.tsx`); non-page:
  `/auth/callback/route.ts`, `/api/auth/{otp,verify,password,signout}`.
- **Public/legal/status/util (5)** — `/legal/[slug]`; `/t/[ref]` public
  order-status share; `/offline` SW fallback; `/design` design-lab (rewritten
  from `/_design`, `next.config.ts`); `/[...rest]` localized 404.

## 5. Infrastructure readiness

Two columns: what we can prepare now with no new infrastructure, and what
waits on their server + domain (plus go-live credentials).

| Area                                                                  | Prepare now                                                                                                                                                                                                                                                                                                                                                                                                            | Waits on their server + domain                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service worker (`src/app/sw.ts` via `@serwist/next`, disabled in dev) | Today: app-shell precache (`__SW_MANIFEST`), NetworkFirst `/api/rates` (cache `asaex-rates`, 6 s timeout, offline reload shows last snapshot with age banner), Serwist `defaultCache` for static assets/fonts/images, `/offline` fallback, `navigationPreload` + `skipWaiting`/`clientsClaim`. Add: StaleWhileRevalidate for `/api/rates/history`; cache-then-network for order lists once persisted queries (§3) land | —                                                                                                                                                                                                                                                                                                                          |
| Fonts                                                                 | Nothing to do — already optimal and Iran-safe: self-hosted variable Vazirmatn + Inter via `next/font/local` (`src/app/[locale]/layout.tsx`, `display:swap`), copied from node_modules by `scripts/sync-fonts.mjs` into `src/fonts/`; CSP `font-src 'self'`                                                                                                                                                             | —                                                                                                                                                                                                                                                                                                                          |
| Supabase Realtime                                                     | One channel pattern exists: `conversation:${id}` subscribing `postgres_changes` INSERT on `messages` (`src/components/chat/conversation.tsx:49`); admin `live-feed.tsx` is server-rendered, _not_ live. Add channels: order state transitions (`orders/[id]` timeline), office request queue, broadcast rate ticks, presence/typing in chat — CSP already whitelists the `wss:` Supabase origin (`next.config.ts`)     | —                                                                                                                                                                                                                                                                                                                          |
| HTTP/2-3 + CDN                                                        | All asset URLs are origin-relative and `appOrigin()` (`src/lib/app-url.ts`) centralizes the host, so the move is config-only                                                                                                                                                                                                                                                                                           | Caddy/nginx with h2 + h3 (QUIC), `immutable` caching on `/_next/static`, Brotli, and an in-country CDN/edge (e.g. ArvanCloud) for Iranian latency                                                                                                                                                                          |
| Supabase hosting (not deciding here)                                  | Switch cost is low by design: CSP + clients derive everything from `NEXT_PUBLIC_SUPABASE_URL` (`next.config.ts`, `src/lib/supabase/*`); ADR 0010 (no service-role key in app) holds either way                                                                                                                                                                                                                         | Self-hosted on their server = own domain (helps filtering + CSP), data residency, one hop to the app — but they operate Postgres/Auth/Realtime/Storage upgrades and backups. Managed = zero ops, automatic backups/upgrades — but `*.supabase.co` reachability/latency from Iran is the risk and data leaves their control |
| SMS (Kavenegar)                                                       | Already wired and deliberately deferred (final stage, as planned): `SmsProvider` abstraction `src/lib/sms/{types,console,kavenegar,index}.ts`, console fallback logs the code server-side; an unwired phone path reports `sms_channel_unavailable` plainly (ADR 0011), OTP delivery path fixed in ADR 0011 (Supabase Auth send-sms-hook → Edge Function → provider)                                                    | Go-live: set `SMS_PROVIDER=kavenegar` + credentials + register the `asaex-otp` pattern                                                                                                                                                                                                                                     |
| Native shell                                                          | Keep everything working as a pure PWA (already true); the shell is an additive wrapper later                                                                                                                                                                                                                                                                                                                           | Capacitor shell + store presence (§6)                                                                                                                                                                                                                                                                                      |

## 6. App-store reality and the native-shell path

### 6.1 The rules that bind a finance app

From the [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/):

> **3.2.1(viii):** "Apps used for financial trading, investing, or money
> management should be submitted by the financial institution performing such
> services and must have necessary licensing and permissions in the locations
> where you make them available."

> **5.1.1(ix):** "Apps that provide services in highly regulated fields (such
> as banking and financial services, healthcare, gambling, legal cannabis
> use, air travel and crypto exchanges) or that require sensitive user
> information should be submitted by a legal entity that provides the
> services, and not by an individual developer."

Net effect: a remittance app must be submitted from the developer account of
the licensed money-services entity itself, with licenses valid in every
storefront where it's offered.

### 6.2 Iran storefront facts

- There is no Apple App Store storefront for Iran. Apple's message to
  developers: "Unfortunately, there is no App Store available for the
  territory of Iran. Additionally, apps facilitating transactions for
  businesses or entities based in Iran may not comply with the Iranian
  Transactions Sanctions Regulations (31 CFR Part 560) when hosted on the App
  Store."
  ([MacRumors](https://www.macrumors.com/2017/08/24/apple-removing-iranian-apps-from-app-store/))
- Aug 2017: Apple removed popular Iranian apps (Snapp, food delivery,
  shopping) from foreign storefronts citing US sanctions
  ([AppleInsider](https://appleinsider.com/articles/17/08/24/apple-removes-iranian-apps-from-app-store-cites-us-sanctions), [Bloomberg](https://www.bloomberg.com/news/articles/2017-08-25/apple-cuts-iran-apps-from-store-due-to-sanctions-founders-say)).
- Mar 2018: App Store access blocked from Iranian IP addresses
  ([AppleInsider](https://appleinsider.com/articles/18/03/15/the-app-store-has-reportedly-been-blocked-in-iran)).
- Mar 2019: Apple revoked enterprise distribution certificates used by
  Iranian apps, breaking them for millions of iPhone users overnight
  ([CHRI](https://iranhumanrights.org/2019/03/millions-of-iphone-users-unable-to-use-iranian-apps-due-to-apple-certificate-revocation/)).
- OFAC has confirmed to a developer that exportation by US persons of most
  items, technology, and services to Iran remains prohibited under ITSR
  (31 CFR Part 560). The practical point: iPhones are widely used in Iran
  (grey-market imports) but served by no official store; a diaspora-facing
  remittance product **can** ship on the App Store in its licensed corridors
  (e.g. EU/UK/CA storefronts) provided the transacting entities are outside
  Iran and sanctions-compliant — apps "facilitating transactions for
  businesses or entities based in Iran" are what Apple's notice excludes.

### 6.3 Realistic distribution paths

- **PWA on the open web** — reaches all platforms including Iranian iPhones
  with no store gatekeeper; the proven fallback Iranian companies adopted
  after 2017/2019. Since iOS/iPadOS 16.4, Home Screen web apps support Web
  Push and the Badging API ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/):
  "we are adding support for Web Push to Home Screen web apps"). Remaining
  iOS PWA limits: no NFC/background-sync parity with native, storage eviction
  pressure, install friction (manual Add to Home Screen).
- **Android inside Iran** — Google Play is impractical (payments blocked,
  Google services restricted). Cafe Bazaar is the dominant local store — ~85%
  market share, ~29M MAU (earlier reports cite up to 97% domestic share);
  Myket is #2 with 8M+ active users; others: Iranapps, Candoo, ParsHub. Cafe
  Bazaar contracts with non-Iranian developers on a 70/30 revenue split.
  Direct APK download from the product's own site is normal practice
  ([Similarweb](https://www.similarweb.com/company/cafebazaar.ir/), [AzerNews](https://www.azernews.az/region/118470.html), [AzerNews](https://www.azernews.az/region/118444.html), [Mobile World Live](https://www.mobileworldlive.com/apple/qa-cafe-bazaar-discusses-iran-apps-market/)).
- **iOS hard limits** — no Iran storefront and the App Store is blocked from
  Iranian IPs; enterprise-certificate sideloading was the historical
  workaround and Apple killed it in 2019; EU DMA alternative distribution
  applies only to EU-storefront devices, not Iran; TestFlight requires the
  same App Store Connect / developer-program compliance. Practical iOS
  strategy: PWA for users in Iran + a normal App Store app (submitted by the
  licensed financial entity, per 3.2.1(viii)/5.1.1(ix)) for the diaspora
  corridors where the product is licensed.

### 6.4 The native-shell path

- **Capacitor shell** reusing this codebase (WKWebView): brings real push,
  `@capacitor/haptics`, and App Store presence; needs a remote-URL or
  static-export strategy for the App Router server pieces.
- **Native rewrite**: duplicates the cost of 44 screens plus the brand motion
  system — hard to justify.
- For Iranian Android: ship a **direct APK** (Capacitor or TWA of the PWA),
  **Cafe Bazaar**, and **Myket** — all accept the same signed APK/AAB, none
  require Play billing.
- Now: stay a pure PWA (already true); the shell is an additive wrapper later.

### 6.5 What Apple rewards, if we ever get there

- [HIG](https://developer.apple.com/design/human-interface-guidelines)
  foundations: Clarity, Deference (UI recedes so rates, balances, transfer
  status stay front and center), Depth; platform-native navigation;
  purposeful motion only, respecting Reduce Motion
  (`prefers-reduced-motion` on web).
- [Apple Design Awards](https://developer.apple.com/design/awards/):
  **Inclusivity** ("a great experience for all by reflecting a variety of
  backgrounds, abilities, and languages") and **Social Impact** map directly
  to a Persian-language RTL remittance product.
- [Editorial featuring](https://developer.apple.com/app-store/getting-featured/):
  "there's no checklist," but editors weigh user experience, UI design,
  innovation, uniqueness, accessibility, localization ("culturally relevant
  and appropriate content"), and product-page quality. Nominate via Featuring
  Nominations in App Store Connect — minimum 2 weeks, up to 3 months ahead.
