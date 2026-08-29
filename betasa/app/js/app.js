/* بتاسا — هستهٔ اپ: کیف سکه، تم، روتر و لابی */
import { games } from "./games/index.js";

/* ---------- ابزار عدد فارسی ---------- */
const FA = "۰۱۲۳۴۵۶۷۸۹";
export function fmt(n) {
  const s = Math.round(n).toLocaleString("en-US").replace(/,/g, "٬");
  return s.replace(/[0-9]/g, (d) => FA[+d]);
}

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
    return true;
  },
  credit(amount) {
    wallet.balance += Math.max(0, Math.floor(amount));
    saveWallet(); renderBalance();
  },
  fmt,
  toast,
};

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
  const hash = location.hash || "#/";
  const m = hash.match(/^#\/game\/([a-z-]+)$/);
  if (m) {
    const game = games.find((g) => g.id === m[1]);
    if (game) { renderGamePage(game); view.focus(); return; }
  }
  renderLobby();
  view.focus();
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
    <p>ده بازی سریع با سکهٔ مجازی — رایگان و تفریحی، بدون پول واقعی. هر روز جایزهٔ ورود بگیر و رکوردت را بالا ببر.</p>`;
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
  cleanup = game.render(page.querySelector(".game-board"), ctx) || null;
}

/* ---------- کنترل شرط مشترک (برای استفادهٔ بازی‌ها) ---------- */
export function betControls(defaultBet = 100) {
  const el = document.createElement("div");
  el.className = "bet-row";
  el.innerHTML = `
    <input class="bet-input mono" inputmode="numeric" value="${defaultBet}" aria-label="مبلغ سکه">
    <span class="chip-btns">
      <button class="chip-btn" type="button" data-v="100">۱۰۰</button>
      <button class="chip-btn" type="button" data-v="500">۵۰۰</button>
      <button class="chip-btn" type="button" data-v="1000">۱٬۰۰۰</button>
      <button class="chip-btn" type="button" data-mul="2">×۲</button>
      <button class="chip-btn" type="button" data-mul="0.5">½</button>
    </span>`;
  const input = el.querySelector(".bet-input");
  el.querySelectorAll(".chip-btn").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.v) input.value = b.dataset.v;
      else input.value = Math.max(1, Math.floor((+input.value || 0) * +b.dataset.mul));
    })
  );
  return {
    el,
    amount: () => Math.floor(+input.value || 0),
    setDisabled(d) { el.querySelectorAll("input,button").forEach((n) => (n.disabled = d)); },
  };
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
