/* ============================================================================
   بت آسا — «سالنِ طلا»: رفتار صفحهٔ اصلی
   قاعده‌ها: هیچ عدد ساختگی، هیچ رندری روی رویداد پیوسته بدون rAF،
   و زیر prefers-reduced-motion همه‌چیز ساکن اما کامل خوانده می‌شود.
   ========================================================================== */
import { games } from "./games/index.js";
import { carryInviteFromUrl, INVITE_GUEST_BONUS } from "./account.js";

const calm = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ارقام فارسی با جداکنندهٔ هزارگان */
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (n) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "٬").replace(/\d/g, (d) => FA[+d]);

/* ============================ ۱. کفِ سالن ============================ */
(function tables() {
  const host = $("#tables");
  if (!host) return;
  const tone = { board: "تخته‌ای", card: "ورق", number: "عددی", fast: "تند" };
  host.innerHTML = games
    .map((g) => {
      const tag = g.tags?.map((t) => tone[t]).find(Boolean) || "";
      return `<a class="lp-table" href="app.html#/game/${g.id}">
        ${tag ? `<span class="lp-table__chip">${tag}</span>` : ""}
        <span class="lp-table__ico" aria-hidden="true">${g.icon}</span>
        <h3>${g.name}</h3>
        <p>${g.desc}</p>
      </a>`;
    })
    .join("");

  /* هالهٔ طلایی زیر نشانگر — یک بار در هر فریم، نه در هر رویداد */
  if (!calm.matches) {
    let frame = 0, target = null, mx = 0, my = 0;
    host.addEventListener("pointermove", (e) => {
      const card = e.target.closest(".lp-table");
      if (!card) return;
      const r = card.getBoundingClientRect();
      target = card; mx = e.clientX - r.left; my = e.clientY - r.top;
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        target.style.setProperty("--px", mx + "px");
        target.style.setProperty("--py", my + "px");
      });
    });
  }
})();

/* ============================ ۲. نردبان ژتون ============================ */
(function ladder() {
  const host = $("#ladder-grid");
  if (!host) return;
  const chip = (a, b, ring) => `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="${a}" stroke="${ring}" stroke-width="3"/>
      <g stroke="${ring}" stroke-width="8" stroke-linecap="round">
        <path d="M50 6v14"/><path d="M50 80v14"/><path d="M6 50h14"/><path d="M80 50h14"/>
        <path d="M19 19l10 10"/><path d="M81 19L71 29"/><path d="M19 81l10-10"/><path d="M81 81L71 71"/>
      </g>
      <circle cx="50" cy="50" r="27" fill="${b}" stroke="${ring}" stroke-width="3"/>
    </svg>`;

  const tiers = [
    { n: "تازه‌وارد", s: "سطح ۱ به بالا", c: chip("#16283a", "#0d1a26", "#7d7565"), now: true },
    { n: "میزنشین", s: "سطح ۵ به بالا", c: chip("#0a3328", "#06231c", "#35e0d0") },
    { n: "کهنه‌کار", s: "سطح ۱۲ به بالا", c: chip("#2a1636", "#1a0d24", "#8a6bff") },
    { n: "صدرنشین", s: "سطح ۲۵ به بالا", c: chip("#3a2c0d", "#241b06", "#e9c66a") },
  ];
  host.innerHTML = tiers
    .map((t, i) => `<div class="lp-tier${t.now ? " lp-tier--now" : ""}" style="--rise:${i * 22}px">
      <div class="lp-tier__chip">${t.c}</div>
      <b>${t.n}</b><span>${t.s}</span>
    </div>`)
    .join("");
})();

/* ============================ ۳. برش‌های چرخ ============================ */
(function wheelSlices() {
  const g = $("#slices");
  if (!g) return;
  const R = 128, cx = 160, cy = 160, N = 16;
  let out = "";
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
    const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    const fill = i % 4 === 0 ? "#e9c66a" : i % 2 === 0 ? "#ff4d6a" : "#0a1a15";
    out += `<path d="M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${fill}" fill-opacity="${fill === "#0a1a15" ? 1 : .85}" stroke="#04060a" stroke-width="1.5"/>`;
  }
  g.innerHTML = out;
})();

/* ============================ ۴. لامپ‌های قاب ============================ */
(function bulbs() {
  const host = $("#bulbs");
  if (!host) return;
  const per = 9, out = [];
  for (let i = 0; i < per; i++) {
    const t = i / (per - 1);
    out.push(`<i style="left:${(t * 100).toFixed(1)}%;top:0;animation-delay:${(i * .12).toFixed(2)}s"></i>`);
    out.push(`<i style="left:${(t * 100).toFixed(1)}%;bottom:0;animation-delay:${(i * .12 + .8).toFixed(2)}s"></i>`);
  }
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    out.push(`<i style="top:${(t * 100).toFixed(1)}%;left:0;animation-delay:${(i * .14).toFixed(2)}s"></i>`);
    out.push(`<i style="top:${(t * 100).toFixed(1)}%;right:0;animation-delay:${(i * .14 + .8).toFixed(2)}s"></i>`);
  }
  host.innerHTML = out.join("");
})();

/* ============================ ۵. دستگاه اسلات ============================ */
(function slot() {
  const reels = $$("#reels .lp-reel__strip");
  const btn = $("#spin");
  const msg = $("#slotmsg");
  if (!reels.length || !btn) return;

  const FACES = ["🍒", "🔔", "⭐", "💎", "🍋", "7️⃣"];
  const CELL = 132, REPEAT = 8;

  reels.forEach((strip, i) => {
    let html = "";
    for (let r = 0; r < REPEAT; r++) for (const f of FACES) html += `<div class="lp-reel__cell">${f}</div>`;
    strip.innerHTML = html;
    strip.style.transform = `translateY(-${CELL * (FACES.length * 2 + i)}px)`;
  });

  const land = (strip, index, ms) => new Promise((res) => {
    const y = CELL * (FACES.length * (REPEAT - 2) + index);
    if (calm.matches) { strip.style.transform = `translateY(-${y}px)`; return res(); }
    strip.style.transition = `transform ${ms}ms cubic-bezier(.16,.9,.24,1)`;
    strip.style.transform = `translateY(-${y}px)`;
    setTimeout(res, ms);
  });

  const reset = (strip) => {
    strip.style.transition = "none";
    const cur = FACES.length * 2;
    strip.style.transform = `translateY(-${CELL * cur}px)`;
    void strip.offsetHeight;
  };

  let busy = false;
  btn.addEventListener("click", async () => {
    if (busy) return;
    busy = true; btn.disabled = true; msg.textContent = "…";
    reels.forEach(reset);
    const picks = reels.map(() => Math.floor(Math.random() * FACES.length));
    await Promise.all(reels.map((s, i) => land(s, picks[i], 1100 + i * 320)));
    const three = picks[0] === picks[1] && picks[1] === picks[2];
    const two = !three && new Set(picks).size === 2;
    msg.textContent = three ? "سه‌تایی!" : two ? "دوتایی" : "دوباره";
    busy = false; btn.disabled = false;
  });
})();

/* ============================ ۶. بارش سکه ============================ */
(function coins() {
  const cv = $("#coins");
  if (!cv || calm.matches) return;
  const ctx = cv.getContext("2d");
  let w = 0, h = 0, drops = [], raf = 0;

  const size = () => {
    const host = cv.parentElement.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = host.width; h = host.height;
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.width = w + "px"; cv.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const seed = () => {
    const n = Math.round(Math.min(34, w / 42));
    drops = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 5 + Math.random() * 9,
      vy: 14 + Math.random() * 26,
      sp: .4 + Math.random() * 1.1,
      ph: Math.random() * Math.PI * 2,
    }));
  };

  let last = performance.now();
  const frame = (t) => {
    const dt = Math.min((t - last) / 1000, .05); last = t;
    ctx.clearRect(0, 0, w, h);
    for (const d of drops) {
      d.y += d.vy * dt; d.ph += d.sp * dt * 2.2;
      if (d.y - d.r > h) { d.y = -d.r * 2; d.x = Math.random() * w; }
      /* سکه = بیضی‌ای که با فاز می‌چرخد، پس واقعاً «لبه» می‌شود */
      const squash = Math.abs(Math.cos(d.ph));
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.globalAlpha = .12 + squash * .22;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(d.r * squash, .8), d.r, 0, 0, Math.PI * 2);
      const g = ctx.createLinearGradient(0, -d.r, 0, d.r);
      g.addColorStop(0, "#fff0b8"); g.addColorStop(.5, "#e9c66a"); g.addColorStop(1, "#b8871f");
      ctx.fillStyle = g; ctx.fill();
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  };

  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  size(); seed(); start();
  addEventListener("resize", () => { size(); seed(); }, { passive: true });
  /* وقتی قهرمان از دید خارج شد، حلقه می‌ایستد */
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0 }).observe(cv);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
})();

/* ============================ ۷. شمارنده‌ها ============================ */
(function counters() {
  const nodes = $$("[data-count]");
  if (!nodes.length) return;
  const run = (el) => {
    const to = +el.dataset.count;
    if (calm.matches) { el.textContent = fa(to); return; }
    const t0 = performance.now(), dur = 1100;
    const step = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = fa(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
  }, { threshold: .5 });
  nodes.forEach((n) => io.observe(n));
})();

/* ============================ ۸. ورود صحنه‌ها ============================ */
(function rise() {
  const nodes = $$(".lp-rise");
  if (!nodes.length) return;
  if (calm.matches) { nodes.forEach((n) => n.classList.add("is-in")); return; }
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }, { threshold: .12, rootMargin: "0px 0px -8% 0px" });
  nodes.forEach((n) => io.observe(n));
})();

/* ============================ ۹. منو ============================ */
(function nav() {
  const links = $$("#menu a");
  const sections = links.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  if (sections.length) {
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        const link = links.find((a) => a.getAttribute("href") === "#" + e.target.id);
        if (link && e.isIntersecting) {
          links.forEach((a) => a.removeAttribute("aria-current"));
          link.setAttribute("aria-current", "true");
        }
      }
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((s) => io.observe(s));
  }

  const burger = $("#burger"), panel = $("#panel");
  if (!burger || !panel) return;
  const setOpen = (open) => {
    panel.hidden = !open;
    burger.setAttribute("aria-expanded", String(open));
    if (!open) burger.focus();
  };
  burger.addEventListener("click", () => setOpen(panel.hidden));
  panel.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) setOpen(false); });
  document.addEventListener("pointerdown", (e) => {
    if (panel.hidden) return;
    if (!panel.contains(e.target) && !burger.contains(e.target)) setOpen(false);
  });
})();

/* ============================ ۱۰. کد دعوت در آدرس ============================
   کسی که با لینک دعوت آمده باید همان اول بداند چه چیزی انتظارش را می‌کشد؛
   کد تا لحظهٔ ثبت در پروفایل نگه داشته می‌شود. */
(function invite() {
  const code = carryInviteFromUrl();
  if (!code) return;
  const bar = document.createElement("div");
  bar.className = "lp-invite";
  bar.innerHTML = `با کد <b class="ltr">${code}</b> دعوت شده‌ای — ${INVITE_GUEST_BONUS.toLocaleString("fa-IR")} سکهٔ هدیه در پروفایل ثبت می‌شود.
    <a href="app.html#/signin">ورود و ثبت کد</a>`;
  document.querySelector(".lp-nav").insertAdjacentElement("afterend", bar);
})();

/* ============================ ۱۱. سرویس‌ورکر ============================ */
if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
