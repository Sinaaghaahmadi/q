/* بت آسا — هستهٔ اپ: کیف سکه، تم، روتر و لابی */
import { games } from "./games/index.js";
import { fmt, betControls } from "./ui.js";
export { fmt, betControls };

/* ---------- کیف سکه ---------- */
const WALLET_KEY = "betasa-wallet";
const START_COINS = 10000;
const DAILY_BONUS = 2000;

function loadWallet() {
  try {
    const w = JSON.parse(localStorage.getItem(WALLET_KEY));
    if (w && typeof w.balance === "number") return w;
  } catch (e) {}
  return { balance: START_COINS, lastBonus: todayKey() , fresh: true };
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
let wallet = loadWallet();
function saveWallet() {
  try { localStorage.setItem(WALLET_KEY, JSON.stringify(wallet)); } catch (e) {}
}
function renderBalance() {
  document.getElementById("coin-balance").textContent = fmt(wallet.balance);
}
export const ctx = {
  balance: () => wallet.balance,
  bet(amount) {
    amount = Math.floor(amount);
    if (!Number.isFinite(amount) || amount < 1) { toast("مبلغ سکه معتبر نیست"); return false; }
    if (amount > wallet.balance) { toast("سکه کافی نداری!"); return false; }
    wallet.balance -= amount;
    saveWallet(); renderBalance();
    trackRound();
    ledger("bet", -amount, currentGameName || "بازی");
    addXp(Math.max(1, Math.round(amount / 100)));
    return true;
  },
  credit(amount) {
    amount = Math.max(0, Math.floor(amount));
    wallet.balance += amount;
    saveWallet(); renderBalance();
    if (amount > 0) { trackWin(amount); ledger("win", amount, currentGameName || "بازی"); }
  },
  fmt,
  toast,
};

/* ---------- دفتر تراکنش سکه ----------
   هر جابه‌جایی سکه یک سطر می‌شود تا کاربر بتواند بپرسد «سکه‌ام کجا رفت؟».
   واحد همیشه سکهٔ مجازی است؛ هیچ مسیر واریز یا برداشت پول واقعی وجود ندارد. */
const LEDGER_KEY = "betasa-ledger";
const LEDGER_MAX = 60;
function loadLedger() {
  try { const l = JSON.parse(localStorage.getItem(LEDGER_KEY)); if (Array.isArray(l)) return l; } catch (e) {}
  return [];
}
let ledgerRows = loadLedger();
function ledger(kind, amount, label) {
  ledgerRows.unshift({ kind, amount, label, at: Date.now() });
  ledgerRows = ledgerRows.slice(0, LEDGER_MAX);
  try { localStorage.setItem(LEDGER_KEY, JSON.stringify(ledgerRows)); } catch (e) {}
}

/* ---------- سطح و تجربه ----------
   XP فقط از بازی‌کردن می‌آید، نه از برنده‌شدن — تا پیشرفت به شانس گره نخورد. */
const LEVEL_STEP = 120;
function levelOf(xp) { return Math.floor(Math.sqrt(xp / LEVEL_STEP)) + 1; }
function xpForLevel(lv) { return Math.pow(lv - 1, 2) * LEVEL_STEP; }
function addXp(n) {
  const before = levelOf(wallet.xp || 0);
  wallet.xp = (wallet.xp || 0) + n;
  const after = levelOf(wallet.xp);
  saveWallet();
  if (after > before) {
    const reward = after * 250;
    grant(reward);
    ledger("level", reward, `رسیدن به سطح ${fmt(after)}`);
    toast(`سطح ${fmt(after)}! جایزه: ${fmt(reward)} سکه ⭐`);
  }
  renderBalance();
}

/* ---------- آمار، رکوردها و ماموریت‌ها ---------- */
const STATS_KEY = "betasa-stats";
let currentGameName = null;

function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY));
    if (s && Array.isArray(s.topWins)) return s;
  } catch (e) {}
  return { topWins: [], day: todayKey(), rounds: 0, wins: 0, games: [], claimed: [] };
}
let stats = loadStats();
function saveStats() {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) {}
}
function resetDayIfNeeded() {
  const t = todayKey();
  if (stats.day !== t) {
    stats.day = t; stats.rounds = 0; stats.wins = 0; stats.games = []; stats.claimed = [];
    saveStats();
  }
}
function trackRound() {
  resetDayIfNeeded();
  stats.rounds += 1;
  if (currentGameName && !stats.games.includes(currentGameName)) stats.games.push(currentGameName);
  saveStats();
}
function trackWin(amount) {
  resetDayIfNeeded();
  stats.wins += 1;
  stats.topWins.push({ game: currentGameName || "؟", amount, at: todayKey() });
  stats.topWins.sort((a, b) => b.amount - a.amount);
  stats.topWins = stats.topWins.slice(0, 10);
  saveStats();
}

const MISSIONS = [
  { id: "play3", title: "۳ بازی مختلف انجام بده", reward: 500, done: () => stats.games.length >= 3, progress: () => `${fmt(Math.min(stats.games.length, 3))} از ۳` },
  { id: "rounds10", title: "۱۰ دست بازی کن", reward: 700, done: () => stats.rounds >= 10, progress: () => `${fmt(Math.min(stats.rounds, 10))} از ۱۰` },
  { id: "wins5", title: "۵ بار ببر", reward: 1000, done: () => stats.wins >= 5, progress: () => `${fmt(Math.min(stats.wins, 5))} از ۵` },
];

/* واریز جایزه (خارج از بازی — در رکورد بردها ثبت نمی‌شود) */
function grant(amount) {
  wallet.balance += Math.max(0, Math.floor(amount));
  saveWallet(); renderBalance();
}

/* جایزه روزانه با استریک — هر روز پیاپی جایزه را بزرگ‌تر می‌کند، تا سقف هفتم */
function yesterdayKey() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function dailyBonus() {
  const t = todayKey();
  if (!wallet.fresh && wallet.lastBonus !== t) {
    wallet.streak = wallet.lastBonus === yesterdayKey() ? Math.min((wallet.streak || 1) + 1, 7) : 1;
    wallet.lastBonus = t;
    const reward = DAILY_BONUS * wallet.streak;
    wallet.balance += reward;
    saveWallet();
    ledger("daily", reward, `جایزهٔ ورود — روز ${fmt(wallet.streak)}`);
    toast(`جایزه روزانه: ${fmt(reward)} سکه 🎁 (روز ${fmt(wallet.streak)})`);
  }
  if (wallet.fresh) {
    wallet.streak = 1;
    ledger("daily", START_COINS, "هدیهٔ خوش‌آمد");
  }
  delete wallet.fresh;
  saveWallet();
}

/* ---------- توست ---------- */
let toastTimer;
export function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ---------- تم ---------- */
function initTheme() {
  const btn = document.getElementById("theme-toggle");
  btn.addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme === "dark" ||
      (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("betasa-theme", root.dataset.theme); } catch (e) {}
  });
}

/* ---------- روتر ---------- */
const view = document.getElementById("view");
let cleanup = null;

function route() {
  if (typeof cleanup === "function") { try { cleanup(); } catch (e) {} }
  cleanup = null;
  view.innerHTML = "";
  currentGameName = null;
  const hash = location.hash || "#/";
  const m = hash.match(/^#\/game\/([a-z-]+)$/);
  if (m) {
    const game = games.find((g) => g.id === m[1]);
    if (game) { renderGamePage(game); view.focus(); return; }
  }
  if (hash === "#/leaderboard") { renderLeaderboard(); view.focus(); return; }
  if (hash === "#/rewards") { renderRewards(); view.focus(); return; }
  if (hash === "#/wallet") { renderWallet(); view.focus(); return; }
  if (hash.startsWith("#/games")) { renderGames(hash); view.focus(); return; }
  renderLobby();
  view.focus();
}

/* ---------- کیف سکه ----------
   عمداً هیچ مسیر «افزایش موجودی با پول» ندارد: سکه فقط از بازی، جایزهٔ
   روزانه، ماموریت‌ها و بالا رفتن سطح می‌آید. */
const LEDGER_LABEL = { bet: "شرط", win: "برد", daily: "جایزهٔ ورود", mission: "ماموریت", level: "سطح جدید" };

function renderWallet() {
  document.title = "بت آسا — کیف سکه";
  resetDayIfNeeded();
  const xp = wallet.xp || 0;
  const lv = levelOf(xp);
  const base = xpForLevel(lv), next = xpForLevel(lv + 1);
  const pct = Math.round(((xp - base) / (next - base)) * 100);

  const page = document.createElement("div");
  page.className = "game-page";
  page.innerHTML = `
    <div class="game-head">
      <button class="back" type="button">→ خانه</button>
      <h1>کیف سکه</h1>
    </div>

    <div class="game-board" style="text-align:center">
      <div class="muted" style="font-size:var(--fs-sm)">موجودی</div>
      <div class="mono" style="font-size:clamp(2rem,7vw,3rem);font-weight:900;color:var(--gold-ink);line-height:1.2">
        ${fmt(wallet.balance)}
      </div>
      <div class="muted">سکهٔ مجازی</div>

      <div style="margin-top:var(--sp-6);text-align:right">
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);font-weight:700">
          <span>سطح ${fmt(lv)}</span>
          <span class="mono muted">${fmt(xp - base)} / ${fmt(next - base)} XP</span>
        </div>
        <div style="height:10px;border-radius:var(--r-pill);background:var(--surface-2);
                    border:1px solid var(--line);overflow:hidden;margin-top:var(--sp-2)">
          <div style="height:100%;width:${pct}%;background:var(--gold-grad);
                      transition:width var(--dur-slow) var(--ease-out)"></div>
        </div>
        <p class="muted" style="margin:var(--sp-2) 0 0;font-size:var(--fs-caption)">
          هر دست بازی XP می‌دهد — چه ببری چه نبری. هر سطح، جایزهٔ سکه‌ای دارد.
        </p>
      </div>
    </div>

    <h2 class="section-title">راه‌های گرفتن سکه</h2>
    <div class="ways"></div>

    <h2 class="section-title">تراکنش‌های اخیر</h2>
    <div class="game-board" style="padding:0;overflow:hidden"><div class="ledger"></div></div>

    <p class="muted" style="text-align:center;margin-top:var(--sp-5);font-size:var(--fs-caption)">
      بت آسا فروشگاه سکه ندارد و سکه با پول واقعی خرید و فروش نمی‌شود.
    </p>`;
  page.querySelector(".back").addEventListener("click", () => { location.hash = "#/"; });

  const ways = page.querySelector(".ways");
  ways.style.cssText = "display:grid;gap:var(--sp-3);grid-template-columns:repeat(auto-fit,minmax(210px,1fr))";
  const streak = wallet.streak || 1;
  [
    ["🎁", "جایزهٔ ورود روزانه", `امروز گرفتی — روز ${fmt(streak)} پیاپی. هر روز پشت‌سرهم جایزه را بزرگ‌تر می‌کند تا روز هفتم.`, null],
    ["🎯", "ماموریت‌های روزانه", "سه ماموریت هر روز نو می‌شود؛ هر کدام سکهٔ جداگانه دارد.", "#/rewards"],
    ["⭐", "بالا رفتن سطح", `الان سطح ${fmt(lv)}. جایزهٔ سطح بعدی: ${fmt((lv + 1) * 250)} سکه.`, null],
    ["🎮", "خودِ بازی", "برد در هر بازی مستقیم به موجودی اضافه می‌شود.", "#/games"],
  ].forEach(([icon, title, body, href]) => {
    const el = document.createElement(href ? "a" : "div");
    if (href) el.href = href;
    el.style.cssText = "border:1px solid var(--line);border-radius:var(--r-lg);background:var(--surface);padding:var(--sp-4);box-shadow:var(--shadow);display:block";
    el.innerHTML = `<div style="font-size:1.5rem">${icon}</div>
      <div style="font-weight:900;margin-top:var(--sp-1)">${title}</div>
      <p class="muted" style="margin:var(--sp-1) 0 0;font-size:var(--fs-caption)">${body}</p>`;
    ways.appendChild(el);
  });

  const led = page.querySelector(".ledger");
  if (!ledgerRows.length) {
    led.innerHTML = `<p class="muted" style="text-align:center;padding:var(--sp-6)">هنوز تراکنشی نداری.</p>`;
  } else {
    for (const r of ledgerRows.slice(0, 25)) {
      const pos = r.amount >= 0;
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);padding:var(--sp-3) var(--sp-4);border-bottom:1px solid var(--line)";
      row.innerHTML = `
        <div>
          <div style="font-weight:700;font-size:var(--fs-sm)">${LEDGER_LABEL[r.kind] || r.kind} · ${r.label}</div>
          <div class="muted mono" style="font-size:var(--fs-caption)">${timeAgo(r.at)}</div>
        </div>
        <div class="mono" style="font-weight:900;color:${pos ? "var(--win)" : "var(--ink-2)"}">
          ${pos ? "+" : "−"}${fmt(Math.abs(r.amount))}
        </div>`;
      led.appendChild(row);
    }
  }
  view.appendChild(page);
}

function timeAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "چند لحظه پیش";
  if (s < 3600) return `${fmt(Math.floor(s / 60))} دقیقه پیش`;
  if (s < 86400) return `${fmt(Math.floor(s / 3600))} ساعت پیش`;
  return `${fmt(Math.floor(s / 86400))} روز پیش`;
}

/* ---------- صفحهٔ بازی‌ها ---------- */
const CATEGORIES = [
  { id: "all", label: "همه" },
  { id: "fast", label: "سریع" },
  { id: "card", label: "کارتی" },
  { id: "board", label: "تخته‌ای" },
  { id: "number", label: "عددی" },
];

function renderGames(hash) {
  document.title = "بت آسا — بازی‌ها";
  const cat = (hash.split("cat=")[1] || "all").replace(/[^a-z]/g, "") || "all";

  const page = document.createElement("div");
  page.innerHTML = `
    <div class="games-hero">
      <h1>بازی‌ها</h1>
      <p>${fmt(games.length)} بازی، همه با سکهٔ مجازی. یکی را انتخاب کن و شروع کن.</p>
    </div>
    <div class="games-toolbar">
      <div class="cat-row" role="tablist" aria-label="دسته‌بندی"></div>
      <input class="game-search" type="search" placeholder="جست‌وجوی بازی…" aria-label="جست‌وجوی بازی">
    </div>
    <div class="game-grid"></div>
    <p class="empty muted" hidden style="text-align:center;padding:var(--sp-8)">بازی‌ای با این نام پیدا نشد.</p>`;

  const catRow = page.querySelector(".cat-row");
  for (const c of CATEGORIES) {
    const a = document.createElement("a");
    a.className = "cat-chip" + (c.id === cat ? " is-on" : "");
    a.href = `#/games?cat=${c.id}`;
    a.textContent = c.label;
    a.setAttribute("role", "tab");
    a.setAttribute("aria-selected", String(c.id === cat));
    catRow.appendChild(a);
  }

  const grid = page.querySelector(".game-grid");
  const empty = page.querySelector(".empty");
  const search = page.querySelector(".game-search");

  const draw = () => {
    const q = search.value.trim();
    grid.innerHTML = "";
    const list = games.filter(
      (g) => (cat === "all" || (g.tags || []).includes(cat)) && (!q || g.name.includes(q) || g.desc.includes(q))
    );
    for (const g of list) grid.appendChild(gameCard(g));
    empty.hidden = list.length > 0;
  };
  search.addEventListener("input", draw);
  draw();
  view.appendChild(page);
  return () => {};
}

function gameCard(g) {
  const card = document.createElement("a");
  card.className = "game-card";
  card.href = `#/game/${g.id}`;
  card.innerHTML = `
    <span class="g-icon" aria-hidden="true">${g.icon}</span>
    <span class="g-name">${g.name}</span>
    <span class="g-desc">${g.desc}</span>`;
  return card;
}

/* ---------- جدول امتیازات ---------- */
function renderLeaderboard() {
  document.title = "بت آسا — جدول امتیازات";
  resetDayIfNeeded();
  const page = document.createElement("div");
  page.className = "game-page";
  const rows = stats.topWins.length
    ? stats.topWins.map((w, i) => `
        <tr>
          <td class="mono">${fmt(i + 1)}</td>
          <td>${w.game}</td>
          <td class="mono" style="color:var(--win);font-weight:900">+${fmt(w.amount)}</td>
          <td class="mono muted">${w.at.replace(/-/g, "/")}</td>
        </tr>`).join("")
    : `<tr><td colspan="4" class="muted" style="text-align:center;padding:24px">هنوز بردی ثبت نشده — برو بازی کن!</td></tr>`;
  page.innerHTML = `
    <div class="game-head">
      <button class="back" type="button">→ خانه</button>
      <h1>بزرگ‌ترین بردهای تو</h1>
    </div>
    <div class="game-board" style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;text-align:right">
        <thead><tr style="border-bottom:1px solid var(--line)">
          <th style="padding:8px">#</th><th style="padding:8px">بازی</th><th style="padding:8px">برد (سکه)</th><th style="padding:8px">تاریخ</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="muted" style="margin-block:14px 0">امروز: ${fmt(stats.rounds)} دست، ${fmt(stats.wins)} برد، ${fmt(stats.games.length)} بازی مختلف.</p>
    </div>`;
  page.querySelector(".back").addEventListener("click", () => { location.hash = "#/"; });
  view.appendChild(page);
}

/* ---------- ماموریت‌های روزانه ---------- */
function renderRewards() {
  document.title = "بت آسا — جوایز و ماموریت‌ها";
  resetDayIfNeeded();
  const page = document.createElement("div");
  page.className = "game-page";
  page.innerHTML = `
    <div class="game-head">
      <button class="back" type="button">→ خانه</button>
      <h1>ماموریت‌های امروز</h1>
    </div>
    <div class="game-board"><div id="mission-list" style="display:grid;gap:12px"></div>
      <p class="muted" style="margin-block:14px 0">ماموریت‌ها هر روز نو می‌شوند. جایزه‌ها سکهٔ مجازی‌اند.</p>
    </div>`;
  page.querySelector(".back").addEventListener("click", () => { location.hash = "#/"; });
  const list = page.querySelector("#mission-list");
  const draw = () => {
    list.innerHTML = "";
    for (const ms of MISSIONS) {
      const claimed = stats.claimed.includes(ms.id);
      const done = ms.done();
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:12px;border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:var(--surface-2)";
      row.innerHTML = `
        <div style="flex:1">
          <div style="font-weight:900">${ms.title}</div>
          <div class="muted mono">${ms.progress()} — جایزه: ${fmt(ms.reward)} سکه</div>
        </div>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = done && !claimed ? "btn btn-gold" : "btn";
      btn.disabled = !done || claimed;
      btn.textContent = claimed ? "دریافت شد ✓" : done ? "دریافت جایزه" : "در جریان…";
      btn.addEventListener("click", () => {
        if (!ms.done() || stats.claimed.includes(ms.id)) return;
        stats.claimed.push(ms.id);
        saveStats();
        grant(ms.reward);
        ledger("mission", ms.reward, ms.title);
        toast(`جایزه ماموریت: ${fmt(ms.reward)} سکه 🎉`);
        draw();
      });
      row.appendChild(btn);
      list.appendChild(row);
    }
  };
  draw();
  view.appendChild(page);
}

/* ---------- لابی ---------- */
function renderLobby() {
  document.title = "بت آسا — بازی رایگان با سکه";
  const lv = levelOf(wallet.xp || 0);
  const hero = document.createElement("section");
  hero.className = "lobby-hero";
  hero.innerHTML = `
    <svg class="girih" width="220" height="220" viewBox="0 0 100 100" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1">
        <path d="M50 5 L78 20 L78 50 L50 65 L22 50 L22 20 Z"/>
        <path d="M50 20 L92 45 M50 20 L8 45 M50 65 L50 98"/>
        <circle cx="50" cy="42" r="12"/>
      </g>
    </svg>
    <h1>شب‌خوش! آماده‌ای؟</h1>
    <p>${fmt(games.length)} بازی با سکهٔ مجازی — رایگان و تفریحی، بدون پول واقعی.
       سطح ${fmt(lv)}، روز ${fmt(wallet.streak || 1)} پیاپی.</p>
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
      <a class="btn btn-gold" href="#/games">🎮 همهٔ بازی‌ها</a>
      <a class="btn" href="#/rewards">🎁 ماموریت‌ها</a>
      <a class="btn" href="#/wallet">👛 کیف سکه</a>
      <a class="btn" href="#/leaderboard">🏆 رکوردها</a>
    </div>`;
  view.appendChild(hero);

  const sections = [
    ["پیشنهاد امروز", games.slice(0, 4)],
    ["تخته‌ای و کارتی", games.filter((g) => (g.tags || []).some((t) => t === "board" || t === "card"))],
    ["سریع", games.filter((g) => (g.tags || []).includes("fast"))],
  ];
  for (const [label, list] of sections) {
    if (!list.length) continue;
    const h = document.createElement("h2");
    h.className = "section-title";
    h.textContent = label;
    view.appendChild(h);
    const grid = document.createElement("div");
    grid.className = "game-grid";
    for (const g of list) grid.appendChild(gameCard(g));
    view.appendChild(grid);
  }
}

/* ---------- صفحه بازی ---------- */
function renderGamePage(game) {
  document.title = `بت آسا — ${game.name}`;
  const page = document.createElement("div");
  page.className = "game-page";
  page.innerHTML = `
    <div class="game-head">
      <button class="back" type="button">→ خانه</button>
      <h1>${game.name}</h1>
    </div>
    <div class="game-board"></div>
    <p class="muted" style="text-align:center;margin-top:12px">بازی تفریحی با سکهٔ مجازی — بدون پول واقعی.</p>`;
  page.querySelector(".back").addEventListener("click", () => { location.hash = "#/"; });
  view.appendChild(page);
  currentGameName = game.name;
  cleanup = game.render(page.querySelector(".game-board"), ctx) || null;
}

/* ---------- PWA: نصب و سرویس‌ورکر ---------- */
function initPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  const strip = document.getElementById("install-strip");
  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    try { if (localStorage.getItem("betasa-install-dismissed")) return; } catch (err) {}
    strip.hidden = false;
  });
  document.getElementById("install-btn").addEventListener("click", async () => {
    strip.hidden = true;
    if (deferred) { deferred.prompt(); deferred = null; }
  });
  document.getElementById("install-dismiss").addEventListener("click", () => {
    strip.hidden = true;
    try { localStorage.setItem("betasa-install-dismissed", "1"); } catch (e) {}
  });
}

/* ---------- شروع ---------- */
initTheme();
initPWA();
dailyBonus();
renderBalance();
window.addEventListener("hashchange", route);
route();
