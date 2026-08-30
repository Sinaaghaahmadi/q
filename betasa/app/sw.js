/* بت آسا — سرویس‌ورکر: کش آفلاین ساده (cache-first برای دارایی‌ها، network-first برای ناوبری) */
const CACHE = "betasa-v7";
const ASSETS = [
  "./",
  "index.html",
  "app.html",
  "design-system.html",
  "css/betasa.css",
  "css/landing.css",
  "fonts/Vazirmatn-Variable.woff2",
  "js/app.js",
  "js/landing.js",
  "js/ui.js",
  "js/account.js",
  "js/pages/auth.js",
  "js/games/index.js",
  "js/games/coinflip.js",
  "js/games/dice.js",
  "js/games/hilo.js",
  "js/games/wheel.js",
  "js/games/mines.js",
  "js/games/tower.js",
  "js/games/keno.js",
  "js/games/crash.js",
  "js/games/limbo.js",
  "js/games/plinko.js",
  "js/games/poker.js",
  "js/games/backgammon.js",
  "manifest.webmanifest",
  "icons/icon.svg",
];

self.addEventListener("install", (e) => {
  // هر دارایی جداگانه کش می‌شود: روی میزبانی با cleanUrls بعضی مسیرها ۳۰۸ می‌خورند
  // و addAll یک‌جا کل نصب را رد می‌کند. تک‌تک، شکستِ یکی بقیه را زمین نمی‌زند.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(ASSETS.map((a) => cachePath(c, a))))
      .then(() => self.skipWaiting())
  );
});

/** پاسخِ ری‌دایرکت‌شده را Cache.put رد می‌کند؛ پس بدنه را در یک پاسخ تازه می‌ریزیم. */
async function cachePath(cache, path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return;
    if (!res.redirected) return cache.put(path, res);
    const body = await res.blob();
    await cache.put(path, new Response(body, { status: 200, headers: res.headers }));
  } catch {
    /* یک دارایی نرسید؛ نصب سرویس‌ورکر نباید به‌خاطرش شکست بخورد */
  }
}

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          if (!res.redirected) caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((res) => {
          const copy = res.clone();
          if (res.ok && !res.redirected) caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return res;
        })
    )
  );
});
