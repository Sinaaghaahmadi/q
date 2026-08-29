/* بت آسا — سرویس‌ورکر: کش آفلاین ساده (cache-first برای دارایی‌ها، network-first برای ناوبری) */
const CACHE = "betasa-v3";
const ASSETS = [
  "./",
  "index.html",
  "design-system.html",
  "css/betasa.css",
  "fonts/Vazirmatn-Variable.woff2",
  "js/app.js",
  "js/ui.js",
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
  "manifest.webmanifest",
  "icons/icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

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
          caches.open(CACHE).then((c) => c.put(e.request, copy));
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
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
    )
  );
});
