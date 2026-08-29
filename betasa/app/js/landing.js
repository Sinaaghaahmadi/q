/* بت آسا — لندینگ: میدان واکنش‌گر، ناوبری، اسلایدرها، پرسش‌ها و حرکت.
   بازی‌ها از خودِ رجیستری محصول خوانده می‌شوند تا کاتالوگ لندینگ
   هیچ‌وقت از اپ عقب نیفتد. */
import { games } from "./games/index.js";
import { fmt } from "./ui.js";

const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
const reduce = motionQuery.matches;

/* ---------- تم ---------- */
document.getElementById("theme-toggle").addEventListener("click", () => {
  const root = document.documentElement;
  const dark =
    root.dataset.theme === "dark" ||
    (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("betasa-theme", root.dataset.theme); } catch (e) {}
});

/* ---------- میدان واکنش‌گر به نشانگر ----------
   موقعیت نشانگر فقط یک‌بار در هر فریم روی دو متغیر CSS نوشته می‌شود؛
   هیچ عنصری در mousemove دوباره رندر نمی‌شود. روی نشانگر درشت (لمسی)
   به‌جای دنبال‌کردن نشانگر، میدان خودش آرام می‌لغزد. زیر
   prefers-reduced-motion هیچ‌کدام اجرا نمی‌شود. */
const field = document.getElementById("lp-field");
const hero = document.getElementById("hero");
if (field && hero && !reduce) {
  const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
  if (fine) {
    let tx = 0, ty = 0, queued = false;
    const flush = () => {
      queued = false;
      field.style.setProperty("--mx", tx.toFixed(4));
      field.style.setProperty("--my", ty.toFixed(4));
    };
    window.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1));
      ty = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1));
      if (!queued) { queued = true; requestAnimationFrame(flush); }
    }, { passive: true });
  } else {
    /* لغزش خودکار: یک دور آرام لیساژو، بدون نیاز به نشانگر */
    field.classList.add("is-drifting");
    let t = 0;
    setInterval(() => {
      t += 0.06;
      field.style.setProperty("--mx", Math.sin(t).toFixed(4));
      field.style.setProperty("--my", Math.cos(t * 0.7).toFixed(4));
    }, 1200);
  }
}

/* ---------- منوی موبایل ---------- */
const burger = document.getElementById("lp-burger");
const menu = document.getElementById("lp-menu");
const scrim = document.getElementById("lp-scrim");
let lastFocus = null;

function openMenu() {
  lastFocus = document.activeElement;
  menu.hidden = false;
  scrim.hidden = false;
  burger.setAttribute("aria-expanded", "true");
  burger.setAttribute("aria-label", "بستن منو");
  document.body.style.overflow = "hidden";
  const first = menu.querySelector("a");
  if (first) first.focus();
}
function closeMenu(restore = true) {
  if (menu.hidden) return;
  menu.hidden = true;
  scrim.hidden = true;
  burger.setAttribute("aria-expanded", "false");
  burger.setAttribute("aria-label", "باز کردن منو");
  document.body.style.overflow = "";
  if (restore && lastFocus) lastFocus.focus();
}
burger.addEventListener("click", () => (menu.hidden ? openMenu() : closeMenu()));
scrim.addEventListener("click", () => closeMenu());
menu.addEventListener("click", (e) => { if (e.target.closest("a")) closeMenu(false); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !menu.hidden) { e.preventDefault(); closeMenu(); }
});
/* کلیک بیرون از پنل (هرجای صفحه که پنل و دکمه نیست) هم می‌بندد */
document.addEventListener("pointerdown", (e) => {
  if (menu.hidden) return;
  if (!menu.contains(e.target) && !burger.contains(e.target)) closeMenu();
});
addEventListener("resize", () => { if (innerWidth >= 900) closeMenu(false); });

/* ---------- ناوبری: اسکرول نرم و نشانگر بخش فعال ---------- */
const navLinks = [...document.querySelectorAll('.lp-nav a[href^="#"], .lp-menu nav a[href^="#"]')];
for (const a of navLinks) {
  a.addEventListener("click", (e) => {
    const target = document.querySelector(a.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", a.getAttribute("href"));
  });
}
const sections = navLinks
  .map((a) => document.querySelector(a.getAttribute("href")))
  .filter((el, i, arr) => el && arr.indexOf(el) === i);
if ("IntersectionObserver" in window && sections.length) {
  const visible = new Map();
  const navIO = new IntersectionObserver(
    (entries) => {
      for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
      let bestId = "", best = 0;
      for (const [id, r] of visible) if (r > best) { best = r; bestId = id; }
      for (const a of navLinks) a.classList.toggle("is-active", best > 0 && a.getAttribute("href") === "#" + bestId);
    },
    { rootMargin: "-72px 0px -55% 0px", threshold: [0, 0.15, 0.4, 0.75, 1] }
  );
  for (const s of sections) navIO.observe(s);
}

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
VALUES.forEach((v, i) => {
  const card = document.createElement("article");
  card.className = "lp-value lp-reveal";
  card.style.setProperty("--lp-delay", `${i * 90}ms`);
  card.innerHTML = `<span class="lp-value-icon" aria-hidden="true">${v.icon}</span>
    <h3>${v.title}</h3><p>${v.body}</p>`;
  valuesGrid.appendChild(card);
});

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

/* ---------- پرسش‌های پرتکرار ----------
   <details> بومی: باز و بستهٔ آن بدون جاوااسکریپت هم کار می‌کند و
   وضعیتش را خودِ مرورگر به صفحه‌خوان می‌گوید. */
const FAQ = [
  {
    q: "واقعاً هیچ پول واقعی در کار نیست؟",
    a: "هیچ. واحد بازی «سکه» است و سکه نه خریده می‌شود نه فروخته. نه درگاه پرداختی داریم، نه واریز و برداشتی، نه فروشگاه سکه. اگر سکه‌ات تمام شد، جایزهٔ روزانه و ماموریت‌ها دوباره پرش می‌کنند.",
  },
  {
    q: "برای شروع باید ثبت‌نام کنم؟",
    a: "نه. صفحه را باز می‌کنی و همان لحظه ۱۰٬۰۰۰ سکهٔ خوش‌آمد در کیفت است. نه ایمیل می‌خواهیم، نه شمارهٔ تلفن، نه کارت.",
  },
  {
    q: "اطلاعاتم کجا ذخیره می‌شود؟",
    a: "روی همین دستگاه. موجودی، سطح و رکوردهایت در حافظهٔ مرورگر خودت می‌مانند. فونت و کد هم از سرور خودمان می‌آید، نه از CDN بیرونی — یعنی هیچ درخواستی به سرویس ثالث نمی‌رود.",
  },
  {
    q: "بازی‌ها منصفانه‌اند؟ از کجا بدانم؟",
    a: "بازدهٔ هر بازی محاسبه و همان‌جا کنار قوانین نوشته شده است. هیچ عددی پنهان نمی‌ماند و منطق هر بازی در یک ماژول جدا و خوانا زندگی می‌کند.",
  },
  {
    q: "روی گوشی هم کار می‌کند؟ آفلاین چطور؟",
    a: "بله. رابط از پایه برای موبایل و راست‌به‌چپ ساخته شده و می‌توانی مثل یک اپ نصبش کنی. سرویس‌ورکر دارایی‌ها را کش می‌کند، پس با اینترنت ضعیف یا قطع هم بالا می‌آید.",
  },
  {
    q: "چند بازی دارید و بعداً بیشتر می‌شود؟",
    a: `همین حالا ${fmt(games.length)} بازی: از شیر یا خط و تاس تا کرش، پلینکو، پوکر و تخته نردِ کامل. فهرست این صفحه مستقیم از رجیستری خود اپ خوانده می‌شود، پس هر بازی تازه‌ای همین‌جا هم ظاهر می‌شود.`,
  },
];

const faqList = document.getElementById("faq-list");
FAQ.forEach((f, i) => {
  const d = document.createElement("details");
  d.className = "lp-faq-item";
  d.innerHTML = `<summary><span>${f.q}</span><span class="mark" aria-hidden="true">+</span></summary>
    <p class="body">${f.a}</p>`;
  faqList.appendChild(d);
  if (i === 0) d.open = true;
});

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
function step(track, dir) {
  track.scrollBy({ left: dir * firstStep(track) * -1, behavior: reduce ? "auto" : "smooth" });
}

for (const btn of document.querySelectorAll(".lp-arrow")) {
  btn.addEventListener("click", () => {
    const track = document.getElementById(btn.dataset.track);
    stopAuto();
    step(track, Number(btn.dataset.dir));
  });
}
for (const track of document.querySelectorAll(".lp-track")) {
  syncArrows(track);
  track.addEventListener("scroll", () => syncArrows(track), { passive: true });
  new ResizeObserver(() => syncArrows(track)).observe(track);
}

/* ---------- چرخش خودکار ریل بازی‌ها ----------
   تا وقتی کاربر دست نزده جلو می‌رود؛ اولین تماس (لمس، چرخ، کلید، فوکوس)
   برای همیشه خاموشش می‌کند — نه اینکه بعد از چند ثانیه دوباره شروع کند و
   زیر دست کاربر بلغزد. */
let autoTimer = null;
function stopAuto() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
}
if (!reduce && gamesTrack) {
  autoTimer = setInterval(() => {
    if (document.hidden) return;
    const last = gamesTrack.lastElementChild;
    const box = gamesTrack.getBoundingClientRect();
    const done = last && last.getBoundingClientRect().left >= box.left - 8 &&
      last.getBoundingClientRect().right <= box.right + 8;
    if (done) gamesTrack.scrollTo({ left: 0, behavior: "smooth" });
    else step(gamesTrack, 1);
  }, 3600);
  for (const ev of ["pointerdown", "wheel", "keydown", "focusin", "touchstart"]) {
    gamesTrack.addEventListener(ev, stopAuto, { passive: true, once: true });
  }
}

/* ---------- ظاهرشدن هنگام اسکرول (با پلکان) ---------- */
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

/* ---------- شمارنده‌ها ----------
   درون‌یابی عددی (نه انیمیشن CSS) تا ارقام فارسی و tabular بمانند. */
function countUp(el) {
  const target = Number(el.dataset.count || 0);
  if (reduce) { el.textContent = fmt(target); return; }
  const dur = 1400;
  const t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(target * eased);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = fmt(target);
  };
  requestAnimationFrame(tick);
}
const counters = [...document.querySelectorAll("[data-count]")];
if (reduce || !("IntersectionObserver" in window)) {
  counters.forEach(countUp);
} else {
  const cio = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        cio.unobserve(e.target);
        countUp(e.target);
      }
    },
    { threshold: 0.4 }
  );
  counters.forEach((el) => cio.observe(el));
}

/* ---------- سرویس‌ورکر ---------- */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
