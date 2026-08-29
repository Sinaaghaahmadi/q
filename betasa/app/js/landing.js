/* بت آسا — لندینگ: ارزش‌ها، اسلایدرها، و ظاهرشدن هنگام اسکرول.
   بازی‌ها از خودِ رجیستری محصول خوانده می‌شوند تا کاتالوگ لندینگ
   هیچ‌وقت از اپ عقب نیفتد. */
import { games } from "./games/index.js";
import { fmt } from "./ui.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- تم ---------- */
document.getElementById("theme-toggle").addEventListener("click", () => {
  const root = document.documentElement;
  const dark =
    root.dataset.theme === "dark" ||
    (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("betasa-theme", root.dataset.theme); } catch (e) {}
});

/* ---------- ارزش‌های بنیادی ----------
   هر ارزش به یک تصمیم قابل‌بررسی در محصول گره خورده، نه یک شعار. */
const VALUES = [
  {
    title: "منصفانه و شفاف",
    body: "بازده هر بازی محاسبه شده و همان‌جا نوشته می‌شود — مثلاً پوکر ۹۸٫۱۱٪. عددی را پنهان نمی‌کنیم که بعداً غافلگیر شوی.",
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <path d="M24 6v36M10 14h28"/><path d="M10 14 4 28h12z"/><path d="M38 14 32 28h12z"/>
      <path d="M4 28a6 6 0 0 0 12 0M32 28a6 6 0 0 0 12 0"/></svg>`,
  },
  {
    title: "رایگان، بدون ستاره",
    body: "نه فروشگاه سکه داریم نه دکمهٔ افزایش موجودی. سکه فقط از بازی، جایزهٔ روزانه، ماموریت و بالا رفتن سطح می‌آید.",
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <circle cx="24" cy="24" r="17"/><path d="M24 14v20M17 19c0-4 14-4 14 0s-14 4-14 8 14 4 14 0"/></svg>`,
  },
  {
    title: "حریم خصوصی، پیش‌فرض",
    body: "فونت و کد از سرور خودمان می‌آید، نه CDN بیرونی. موجودی و رکوردت روی همین دستگاه می‌ماند.",
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round">
      <path d="M24 5 40 11v13c0 10-7 16-16 19-9-3-16-9-16-19V11z"/><path d="M17 24l5 5 9-10" stroke-linecap="round"/></svg>`,
  },
  {
    title: "ساخته‌شده برای اینجا",
    body: "فارسی و راست‌به‌چپ از پایه، ارقام فارسی، و سبک برای شبکهٔ ضعیف — آفلاین هم بالا می‌آید.",
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5">
      <circle cx="24" cy="24" r="18"/><path d="M6 24h36M24 6c5 5 7 11 7 18s-2 13-7 18c-5-5-7-11-7-18s2-13 7-18z"/></svg>`,
  },
];

const valuesGrid = document.getElementById("values-grid");
for (const v of VALUES) {
  const card = document.createElement("article");
  card.className = "lp-value lp-reveal";
  card.innerHTML = `<span class="lp-value-icon" aria-hidden="true">${v.icon}</span>
    <h3>${v.title}</h3><p>${v.body}</p>`;
  valuesGrid.appendChild(card);
}

/* ---------- اسلایدر بازی‌ها ---------- */
const gamesTrack = document.getElementById("games-track");
for (const g of games) {
  const a = document.createElement("a");
  a.className = "lp-game";
  a.href = `app.html#/game/${g.id}`;
  a.innerHTML = `${g.icon}<span class="name">${g.name}</span><span class="desc">${g.desc}</span>`;
  gamesTrack.appendChild(a);
}

/* ---------- اسلایدر تجربهٔ بازیکن‌ها ----------
   نمونه‌های تست داخلی. قبل از انتشار عمومی با بازخورد واقعی جایگزین شوند؛
   صفحه هم همین را به کاربر می‌گوید و ادعای آمار یا درآمد نمی‌کند. */
const VOICES = [
  { text: "برای وقت‌های مرده عالیه. کرش رو باز می‌کنم، سه دست بازی می‌کنم و می‌بندم. سبکه و لود نمی‌خواد.", who: "بازیکن تست", where: "تهران" },
  { text: "تخته نردش واقعاً قوانین کامل رو داره — بار، مارس، همه چی. ربات هم بی‌خودی نمی‌بازه.", who: "بازیکن تست", where: "اصفهان" },
  { text: "خوبیش اینه که هر بازی نوشته بازدهش چنده. آدم می‌دونه با چی طرفه.", who: "بازیکن تست", where: "شیراز" },
  { text: "ماموریت روزانه باعث می‌شه برگردم. استریک هفت‌روزه رو نمی‌خوام از دست بدم.", who: "بازیکن تست", where: "مشهد" },
  { text: "روی اینترنت ضعیف خونه‌مون هم باز می‌شه، این خودش یه امتیازه.", who: "بازیکن تست", where: "تبریز" },
];

const voicesTrack = document.getElementById("voices-track");
for (const v of VOICES) {
  const fig = document.createElement("figure");
  fig.className = "lp-quote";
  fig.innerHTML = `<p>«${v.text}»</p>
    <footer>
      <span class="lp-avatar" aria-hidden="true">${v.who.slice(0, 1)}</span>
      <span><span class="who">${v.who}</span><br><span class="where">${v.where}</span></span>
    </footer>`;
  voicesTrack.appendChild(fig);
}

/* ---------- کنترل اسلایدرها ----------
   جهت با RTL می‌چرخد: در راست‌به‌چپ scrollLeft منفی می‌شود، پس به‌جای
   حساب‌کردن علامت، از scrollBy با مقدار منطقی استفاده می‌کنیم. */
function firstStep(track) {
  const first = track.firstElementChild;
  if (!first) return 240;
  const gap = parseFloat(getComputedStyle(track).columnGap || "16") || 16;
  return first.getBoundingClientRect().width + gap;
}
function syncArrows(track) {
  // با scroll-snap اجباری، آخرین موقعیتِ قفل‌شونده لبهٔ آخرِ اسکرول نیست، پس
  // مقایسهٔ scrollLeft با scrollWidth هیچ‌وقت «به انتها رسیدیم» نمی‌شود.
  // به‌جایش می‌پرسیم کارت اول و آخر واقعاً داخل قاب دیده می‌شوند یا نه — که
  // هم مستقل از snap است هم از جهت راست‌به‌چپ.
  const EDGE = 8;
  const first = track.firstElementChild;
  const last = track.lastElementChild;
  if (!first || !last) return;
  const box = track.getBoundingClientRect();
  const atStart = first.getBoundingClientRect().left >= box.left - EDGE &&
    first.getBoundingClientRect().right <= box.right + EDGE;
  const atEnd = last.getBoundingClientRect().left >= box.left - EDGE &&
    last.getBoundingClientRect().right <= box.right + EDGE;
  for (const btn of document.querySelectorAll(`.lp-arrow[data-track="${track.id}"]`)) {
    btn.disabled = Number(btn.dataset.dir) < 0 ? atStart : atEnd;
  }
}

for (const btn of document.querySelectorAll(".lp-arrow")) {
  btn.addEventListener("click", () => {
    const track = document.getElementById(btn.dataset.track);
    const dir = Number(btn.dataset.dir);
    track.scrollBy({ left: dir * firstStep(track) * -1, behavior: reduce ? "auto" : "smooth" });
  });
}
for (const track of document.querySelectorAll(".lp-track")) {
  syncArrows(track);
  track.addEventListener("scroll", () => syncArrows(track), { passive: true });
  new ResizeObserver(() => syncArrows(track)).observe(track);
}

/* ---------- ظاهرشدن هنگام اسکرول ---------- */
if (reduce || !("IntersectionObserver" in window)) {
  document.querySelectorAll(".lp-reveal").forEach((el) => el.classList.add("is-in"));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px" }
  );
  document.querySelectorAll(".lp-reveal").forEach((el) => io.observe(el));
}

/* ---------- سکهٔ خوش‌آمد با ارقام فارسی ---------- */
const amount = document.querySelector(".lp-float .amount");
if (amount) amount.textContent = fmt(10000);

/* ---------- سرویس‌ورکر ---------- */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
