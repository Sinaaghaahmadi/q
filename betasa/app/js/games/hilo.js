/* بالا/پایین — حدس بزن کارت بعدی بالاتر است یا پایین‌تر */
import { betControls } from "../app.js";

const FA = "۰۱۲۳۴۵۶۷۸۹";
const faDigits = (s) => String(s).replace(/[0-9]/g, (d) => FA[+d]);
const RANKS = ["آس", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹", "۱۰", "سرباز", "بی‌بی", "شاه"];
const SUITS = ["♠️", "♥️", "♦️", "♣️"];

export default {
  id: "hilo",
  name: "بالا/پایین",
  desc: "کارت بعدی بالاتر یا پایین‌تر؟ زنجیره بساز و بردار.",
  icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5">
    <rect x="14" y="8" width="20" height="28" rx="3"/>
    <path d="M24 40 l-5 -5 M24 40 l5 -5 M24 40 v-8" opacity=".6"/>
    <path d="M21 18 c0-3 6-3 6 0 c0 3-3 3-3 6" />
  </svg>`,

  render(root, ctx) {
    root.innerHTML = `
      <div style="text-align:center">
        <div id="hl-card" style="display:inline-block;min-width:110px;padding:14px 18px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);font-size:1.6rem;font-weight:700">؟</div>
        <p class="muted">مساوی = برگشت شرط. بعد از هر برد می‌توانی برداری یا ادامه بدهی.</p>
        <p class="muted">جایزه فعلی: <b id="hl-pot" class="mono">۰</b> سکه</p>
      </div>`;
    const bet = betControls(100);
    root.appendChild(bet.el);

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px;margin-top:10px";
    row.innerHTML = `
      <button id="hl-hi" class="btn btn-gold btn-block" type="button">بالاتر</button>
      <button id="hl-lo" class="btn btn-turq btn-block" type="button">پایین‌تر</button>`;
    root.appendChild(row);

    const row2 = document.createElement("div");
    row2.style.cssText = "display:flex;gap:10px;margin-top:10px";
    row2.hidden = true;
    row2.innerHTML = `
      <button id="hl-cash" class="btn btn-gold btn-block" type="button">برداشت</button>
      <button id="hl-go" class="btn btn-ghost btn-block" type="button">ادامه</button>`;
    root.appendChild(row2);

    const result = document.createElement("div");
    result.className = "result-line";
    root.appendChild(result);

    const cardEl = root.querySelector("#hl-card");
    const potEl = root.querySelector("#hl-pot");
    const hiBtn = root.querySelector("#hl-hi");
    const loBtn = root.querySelector("#hl-lo");
    const cashBtn = root.querySelector("#hl-cash");
    const goBtn = root.querySelector("#hl-go");

    let cur = 1 + Math.floor(Math.random() * 13);
    let stake = 0;       // شرط پایه زنجیره
    let chain = 1;       // ضریب انباشته
    let busy = false;

    const draw = () => 1 + Math.floor(Math.random() * 13);
    const show = (r) => { cardEl.textContent = `${RANKS[r - 1]} ${SUITS[Math.floor(Math.random() * 4)]}`; };
    const pot = () => Math.floor(stake * chain);
    const updatePot = () => { potEl.textContent = ctx.fmt(pot()); };
    show(cur);

    function multFor(guessHi) {
      const winning = guessHi ? 13 - cur : cur - 1;
      if (winning === 0) return 0;
      return 0.99 / (winning / 12);
    }

    function endChain() {
      stake = 0; chain = 1; updatePot();
      row2.hidden = true;
      bet.setDisabled(false);
    }

    function guess(hi) {
      if (busy) return;
      if (stake === 0) {
        const amount = bet.amount();
        if (!ctx.bet(amount)) return;
        stake = amount; chain = 1;
        bet.setDisabled(true);
      }
      const m = multFor(hi);
      if (m === 0) { ctx.toast("این حدس ممکن نیست!"); return; }
      busy = true;
      const next = draw();
      show(next);
      if (next === cur) {
        cur = next;
        ctx.credit(pot());
        result.className = "result-line";
        result.textContent = "مساوی — شرط برگشت داده شد.";
        endChain();
      } else if (hi ? next > cur : next < cur) {
        cur = next;
        chain *= m;
        updatePot();
        result.className = "result-line win";
        result.textContent = `درست حدس زدی! جایزه: ${ctx.fmt(pot())} سکه (×${faDigits(chain.toFixed(2))})`;
        row2.hidden = false;
      } else {
        cur = next;
        result.className = "result-line lose";
        result.textContent = "اشتباه بود — زنجیره سوخت.";
        endChain();
      }
      busy = false;
    }

    hiBtn.addEventListener("click", () => { if (row2.hidden) guess(true); });
    loBtn.addEventListener("click", () => { if (row2.hidden) guess(false); });
    cashBtn.addEventListener("click", () => {
      ctx.credit(pot());
      result.className = "result-line win";
      result.textContent = `برداشتی: +${ctx.fmt(pot())} سکه`;
      endChain();
    });
    goBtn.addEventListener("click", () => {
      row2.hidden = true;
      result.className = "result-line";
      result.textContent = "بالاتر یا پایین‌تر؟";
    });
  },
};
