/* بتاسا — هستهٔ اپ: کیف سکه، تم، روتر و لابی */
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
    return true;
  },
  credit(amount) {
    amount = Math.max(0, Math.floor(amount));
    wallet.balance += amount;
    saveWallet(); renderBalance();
    if (amount > 0) trackWin(amount);
  },
  fmt,
  toast,
};

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

/* جایزه روزانه */
function dailyBonus() {
  const t = todayKey();
  if (!wallet.fresh && wallet.lastBonus !== t) {
    wallet.lastBonus = t;
    wallet.balance += DAILY_BONUS;
    saveWallet();
    toast(`جایزه روزانه: ${fmt(DAILY_BONUS)} سکه 🎁`);
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
  renderLobby();
  view.focus();
}

/* ---------- جدول امتیازات ---------- */
function renderLeaderboard() {
  document.title = "بتاسا — جدول امتیازات";
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
      <button class="back" type="button">→ لابی</button>
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
  document.title = "بتاسا — جوایز و ماموریت‌ها";
  resetDayIfNeeded();
  const page = document.createElement("div");
  page.className = "game-page";
  page.innerHTML = `
    <div class="game-head">
      <button class="back" type="button">→ لابی</button>
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
  document.title = "بتاسا — بازی رایگان با سکه";
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
    <p>ده بازی سریع با سکهٔ مجازی — رایگان و تفریحی، بدون پول واقعی. هر روز جایزهٔ ورود بگیر و رکوردت را بالا ببر.</p>
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
      <a class="btn" href="#/leaderboard">🏆 جدول امتیازات</a>
      <a class="btn btn-gold" href="#/rewards">🎁 ماموریت‌های امروز</a>
    </div>`;
  view.appendChild(hero);

  const title = document.createElement("h2");
  title.className = "section-title";
  title.textContent = "بازی‌ها";
  view.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "game-grid";
  for (const g of games) {
    const card = document.createElement("a");
    card.className = "game-card";
    card.href = `#/game/${g.id}`;
    card.innerHTML = `
      <span class="g-icon" aria-hidden="true">${g.icon}</span>
      <span class="g-name">${g.name}</span>
      <span class="g-desc">${g.desc}</span>`;
    grid.appendChild(card);
  }
  view.appendChild(grid);
}

/* ---------- صفحه بازی ---------- */
function renderGamePage(game) {
  document.title = `بتاسا — ${game.name}`;
  const page = document.createElement("div");
  page.className = "game-page";
  page.innerHTML = `
    <div class="game-head">
      <button class="back" type="button">→ لابی</button>
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
document.getElementById("coin-chip").addEventListener("click", () =>
  toast(`موجودی: ${fmt(wallet.balance)} سکه`)
);
window.addEventListener("hashchange", route);
route();
