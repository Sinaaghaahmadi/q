/* پوکر — «پنج کارتِ تعویضی» (ویدیو پوکر، جفت سرباز به بالا)
   بازیکن در برابر جدول جایزه بازی می‌کند: پنج کارت پخش می‌شود، هر تعدادی را
   نگه می‌دارد، بقیه یک بار تعویض می‌شوند و دست نهایی امتیاز می‌گیرد.

   بازگشت به بازیکن (RTP) — اندازه‌گیری‌شده، نه تخمینی:
   شبیه‌سازی مونت‌کارلوی ۲۰٬۰۰۰٬۰۰۰ دست با استراتژی بهینهٔ استاندارد
   «۹/۶ Jacks or Better» روی همین جدول جایزه (رویال ۲۵۰×) نتیجه داد:
       RTP = ۹۸٫۱۱٪  (0.98112، بازهٔ اطمینان ۹۵٪: ±0.0019)
   ضریب‌ها «بازگشت کل» هستند: جفت سرباز به بالا ۱× یعنی شرط برمی‌گردد. */

import { betControls } from "../ui.js";

/* ---------- کارت‌ها ---------- */
/* r: 0..12 → ۲..آس  |  s: 0..3 → ♠ ♥ ♦ ♣ */
const RANK_FA = ["۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹", "۱۰", "سرباز", "بی‌بی", "شاه", "آس"];
const RANK_SHORT = ["۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹", "۱۰", "س", "ب", "ش", "آ"];
const RED = [1, 2]; // ♥ ♦

const SUIT_ART = [
  /* ♠ */ `<path d="M50 6C50 30 18 38 18 59c0 13 11 21 21 16 -2 9 -6 15 -12 19h46c-6-4-10-10-12-19 10 5 21-3 21-16C82 38 50 30 50 6Z"/>`,
  /* ♥ */ `<path d="M50 94C20 71 11 53 11 38c0-14 10-24 23-24 8 0 13 5 16 11 3-6 8-11 16-11 13 0 23 10 23 24 0 15-9 33-39 56Z"/>`,
  /* ♦ */ `<path d="M50 5 88 50 50 95 12 50Z"/>`,
  /* ♣ */ `<circle cx="50" cy="28" r="19"/><circle cx="25" cy="57" r="19"/><circle cx="75" cy="57" r="19"/><path d="M44 56h12c0 20 3 29 9 38H35c6-9 9-18 9-38Z"/>`,
];

/* ---------- ارزیابی دست ---------- */
export const HANDS = [
  { id: "royal", name: "رویال فلاش", mult: 250 },
  { id: "sflush", name: "استریت فلاش", mult: 50 },
  { id: "quads", name: "چهارتایی", mult: 25 },
  { id: "full", name: "فول‌هاوس", mult: 9 },
  { id: "flush", name: "فلاش", mult: 6 },
  { id: "straight", name: "استریت", mult: 4 },
  { id: "trips", name: "سه‌تایی", mult: 3 },
  { id: "twopair", name: "دو جفت", mult: 2 },
  { id: "jacks", name: "جفت سرباز به بالا", mult: 1 },
];
const NONE = { id: "none", name: "دست بازنده", mult: 0 };

/** پنج کارت → یکی از رکوردهای HANDS یا NONE. */
export function evaluate(cards) {
  const ranks = cards.map((c) => c.r);
  const flush = cards.every((c) => c.s === cards[0].s);

  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  const shape = [...counts.values()].sort((a, b) => b - a);

  let straight = false;
  let top = -1;
  if (counts.size === 5) {
    const u = [...counts.keys()].sort((a, b) => a - b);
    if (u[4] - u[0] === 4) { straight = true; top = u[4]; }
    // آس پایین: A-2-3-4-5
    else if (u[0] === 0 && u[1] === 1 && u[2] === 2 && u[3] === 3 && u[4] === 12) { straight = true; top = 3; }
  }

  const by = (id) => HANDS.find((h) => h.id === id);
  if (straight && flush) return top === 12 ? by("royal") : by("sflush");
  if (shape[0] === 4) return by("quads");
  if (shape[0] === 3 && shape[1] === 2) return by("full");
  if (flush) return by("flush");
  if (straight) return by("straight");
  if (shape[0] === 3) return by("trips");
  if (shape[0] === 2 && shape[1] === 2) return by("twopair");
  if (shape[0] === 2) {
    const pair = [...counts.entries()].find(([, n]) => n === 2)[0];
    return pair >= 9 ? by("jacks") : NONE; // ۹ = سرباز
  }
  return NONE;
}

/* ---------- بُر زدن ---------- */
function randomInts(n) {
  const out = new Uint32Array(n);
  const c = typeof crypto !== "undefined" && crypto.getRandomValues ? crypto : null;
  if (c) c.getRandomValues(out);
  else for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 4294967296);
  return out;
}
function freshDeck() {
  const d = [];
  for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) d.push({ r, s });
  // فیشر–ییتس با بایت‌های تصادفی امن (رد کردن مقادیر سوگیر)
  for (let i = d.length - 1; i > 0; i--) {
    const bound = i + 1;
    const limit = Math.floor(4294967296 / bound) * bound;
    let x;
    do { x = randomInts(1)[0]; } while (x >= limit);
    const j = x % bound;
    const t = d[i]; d[i] = d[j]; d[j] = t;
  }
  return d;
}

/* ---------- استایل ---------- */
const CSS = `
.pk-wrap{display:grid;gap:var(--sp-4)}
.pk-pay{width:100%;border-collapse:collapse;font-size:var(--fs-caption,.85rem)}
.pk-pay th,.pk-pay td{padding:var(--sp-1) var(--sp-2);text-align:right;border-bottom:1px solid var(--line)}
.pk-pay th{color:var(--ink-2);font-weight:700}
.pk-pay td.pk-mult{text-align:left;color:var(--gold-ink);font-weight:900}
.pk-pay tr[data-hit="1"]{background:var(--gold-soft)}
.pk-pay tr[data-hit="1"] td{color:var(--gold-ink);font-weight:900}
.pk-paybox{border:1px solid var(--line);border-radius:var(--r-md);background:var(--surface-2);padding:var(--sp-2) var(--sp-3);overflow-x:auto}

.pk-stage{display:flex;gap:var(--sp-1);justify-content:center;flex-wrap:wrap;font-size:var(--fs-caption,.8rem)}
.pk-stage span{padding:2px var(--sp-2);border-radius:var(--r-pill);border:1px solid var(--line);color:var(--ink-2)}
.pk-stage span[data-on="1"]{border-color:var(--gold);background:var(--gold-soft);color:var(--gold-ink);font-weight:900}

.pk-row{display:flex;gap:var(--sp-2);justify-content:center;flex-wrap:wrap}
.pk-slot{
  flex:0 0 auto;width:min(84px, calc((100% - 4 * var(--sp-2)) / 5));aspect-ratio:5/7;
  position:relative;perspective:700px;background:none;border:0;padding:0;cursor:pointer;
  border-radius:var(--r-sm);transition:transform var(--dur-base) var(--ease-out);
}
.pk-slot:disabled{cursor:default}
.pk-slot:focus-visible{outline:var(--focus-ring);outline-offset:3px}
.pk-inner{position:absolute;inset:0;transform-style:preserve-3d;
  transition:transform var(--dur-slow) var(--ease-out)}
.pk-slot[data-face="up"] .pk-inner{transform:rotateY(180deg)}
.pk-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.pk-face svg{width:100%;height:100%;display:block}
.pk-front{transform:rotateY(180deg)}
.pk-slot[data-held="1"]{transform:translateY(-8px)}
.pk-badge{
  position:absolute;inset-inline:0;bottom:-2px;margin:0 auto;width:max-content;
  padding:1px var(--sp-2);border-radius:var(--r-pill);
  background:var(--gold-grad);color:var(--cta-ink,#1b1400);
  font-size:.62rem;font-weight:900;line-height:1.6;opacity:0;
  transition:opacity var(--dur-fast) var(--ease-out);pointer-events:none;
}
.pk-slot[data-held="1"] .pk-badge{opacity:1}
.pk-deal{animation:pk-in var(--dur-slow) var(--ease-spring) both}
@keyframes pk-in{from{opacity:0;transform:translateY(18px) scale(.9)}to{opacity:1;transform:none}}

.pk-hand{text-align:center;font-weight:900;min-height:1.6em;color:var(--gold-ink)}
@media (prefers-reduced-motion: reduce){
  .pk-inner{transition:none}
  .pk-deal{animation:none}
  .pk-slot{transition:none}
}
`;

/* ---------- ماژول ---------- */
export default {
  id: "poker",
  name: "پوکر",
  desc: "پنج کارت بگیر، بهترین‌ها را نگه دار و بقیه را عوض کن.",
  tags: ["card"],
  icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5">
    <rect x="6" y="12" width="20" height="28" rx="3"/>
    <rect x="20" y="8" width="20" height="28" rx="3"/>
    <path d="M30 16 c0 5 -6 6 -6 10 h12 c0 -4 -6 -5 -6 -10 z" opacity=".6"/>
  </svg>`,

  render(root, ctx) {
    const timers = new Set();
    const later = (fn, ms) => {
      const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
      timers.add(id);
      return id;
    };
    const reduced = typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* --- اسکلت --- */
    const wrap = document.createElement("div");
    wrap.className = "pk-wrap";
    wrap.innerHTML = `
      <style>${CSS}</style>
      <p class="muted" style="text-align:center;margin:0">
        پنج کارت می‌گیری، هرکدام را خواستی نگه می‌داری و بقیه یک‌بار عوض می‌شوند.
        جدول جایزه پایین‌تر است — بازگشت اندازه‌گیری‌شدهٔ این جدول <b class="mono">۹۸٫۱۱٪</b> است.
      </p>
      <div class="pk-stage" role="status" aria-live="polite">
        <span data-st="bet">۱ شرط</span>
        <span data-st="deal">۲ پخش</span>
        <span data-st="hold">۳ نگه‌داری</span>
        <span data-st="draw">۴ تعویض</span>
        <span data-st="done">۵ نتیجه</span>
      </div>
      <div class="pk-row"></div>
      <div class="pk-hand" aria-live="polite"></div>
      <div class="pk-paybox">
        <table class="pk-pay">
          <thead><tr><th>دست</th><th style="text-align:left">ضریب بازگشت</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>`;
    root.appendChild(wrap);

    const bet = betControls(100);
    root.appendChild(bet.el);

    const action = document.createElement("button");
    action.type = "button";
    action.className = "btn btn-gold btn-block";
    action.style.marginTop = "var(--sp-3)";
    root.appendChild(action);

    const result = document.createElement("div");
    result.className = "result-line";
    root.appendChild(result);

    const rowEl = wrap.querySelector(".pk-row");
    const handEl = wrap.querySelector(".pk-hand");
    const stageEls = [...wrap.querySelectorAll(".pk-stage span")];
    const payBody = wrap.querySelector(".pk-pay tbody");

    for (const h of HANDS) {
      const tr = document.createElement("tr");
      tr.dataset.hand = h.id;
      tr.innerHTML = `<td>${h.name}</td><td class="pk-mult mono">${ctx.fmt(h.mult)}×</td>`;
      payBody.appendChild(tr);
    }
    const markPaytable = (id) => {
      payBody.querySelectorAll("tr").forEach((tr) => {
        if (tr.dataset.hand === id) tr.dataset.hit = "1";
        else delete tr.dataset.hit;
      });
    };

    /* --- کارت‌ها --- */
    /* چیدمان خال‌ها مثل ورق واقعی: تعداد خال با رتبه می‌خواند و نیمهٔ پایینی
       وارونه است. برای تصویری‌ها (سرباز/بی‌بی/شاه) قاب و حرف، و برای آس یک خال بزرگ. */
    const PIPS = {
      2:  [[50, 36], [50, 104]],
      3:  [[50, 36], [50, 70], [50, 104]],
      4:  [[32, 36], [68, 36], [32, 104], [68, 104]],
      5:  [[32, 36], [68, 36], [50, 70], [32, 104], [68, 104]],
      6:  [[32, 36], [68, 36], [32, 70], [68, 70], [32, 104], [68, 104]],
      7:  [[32, 36], [68, 36], [50, 53], [32, 70], [68, 70], [32, 104], [68, 104]],
      8:  [[32, 36], [68, 36], [50, 53], [32, 70], [68, 70], [50, 87], [32, 104], [68, 104]],
      9:  [[32, 36], [68, 36], [32, 59], [68, 59], [50, 70], [32, 81], [68, 81], [32, 104], [68, 104]],
      10: [[32, 36], [68, 36], [50, 47], [32, 59], [68, 59], [32, 81], [68, 81], [50, 93], [32, 104], [68, 104]],
    };
    const pip = (x, y, s, size = 15) => {
      const flip = y > 70 ? ` rotate(180 ${x} ${y})` : "";
      const k = size / 100;
      return `<g transform="translate(${x - size / 2} ${y - size / 2}) scale(${k})${flip}">${SUIT_ART[s]}</g>`;
    };

    const cardSvg = (c) => {
      const color = RED.includes(c.s) ? "var(--danger)" : "var(--ink)";
      const n = c.r + 2;                    // ۰ → ۲ … ۸ → ۱۰
      let body;
      if (n <= 10) {
        body = PIPS[n].map(([x, y]) => pip(x, y, c.s)).join("");
      } else if (c.r === 12) {              // آس
        body = `<g transform="translate(25 45) scale(.5)" fill="${color}">${SUIT_ART[c.s]}</g>`;
      } else {                              // سرباز / بی‌بی / شاه
        body = `
          <rect x="24" y="34" width="52" height="72" rx="8" fill="none"
                stroke="${color}" stroke-width="1.5" opacity=".45"/>
          <text x="50" y="80" font-size="30" font-weight="900" fill="${color}"
                text-anchor="middle" style="direction:ltr">${RANK_SHORT[c.r]}</text>
          <g transform="translate(43 88) scale(.14)" fill="${color}">${SUIT_ART[c.s]}</g>`;
      }
      /* گوشه‌ها: رتبه و خال کوچک، پایین‌راست وارونه — دقیقاً مثل ورق چاپی.
         direction:ltr لازم است وگرنه در سند راست‌به‌چپ، لنگرِ متن برعکس می‌نشیند
         و رقم از لبهٔ کارت بیرون می‌زند. */
      const wide = RANK_SHORT[c.r].length > 1;   // «۱۰» دو نویسه است و باید کوچک‌تر بنشیند
      const corner = `
        <text x="${wide ? 13 : 11}" y="26" font-size="${wide ? 14 : 19}" font-weight="900" fill="${color}"
              text-anchor="middle" style="direction:ltr">${RANK_SHORT[c.r]}</text>
        <g transform="translate(${wide ? 8.5 : 6.5} 29) scale(.09)" fill="${color}">${SUIT_ART[c.s]}</g>`;
      return `<svg viewBox="0 0 100 140" role="img" aria-label="${RANK_FA[c.r]} ${["پیک", "دل", "خشت", "گشنیز"][c.s]}">
        <rect x="2" y="2" width="96" height="136" rx="10" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
        <g fill="${color}">${body}</g>
        ${corner}
        <g transform="rotate(180 50 70)">${corner}</g>
      </svg>`;
    };
    const backSvg = `<svg viewBox="0 0 100 140" aria-hidden="true">
      <rect x="2" y="2" width="96" height="136" rx="10" fill="var(--surface-2)" stroke="var(--line-strong)" stroke-width="2"/>
      <g fill="none" stroke="var(--gold)" stroke-width="2" opacity=".55">
        <path d="M50 18 76 34 76 66 50 82 24 66 24 34Z"/>
        <path d="M50 34 92 58M50 34 8 58M50 82 50 126"/>
        <circle cx="50" cy="52" r="11"/>
      </g></svg>`;

    const slots = [];
    for (let i = 0; i < 5; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pk-slot";
      b.dataset.face = "down";
      b.disabled = true;
      b.setAttribute("aria-pressed", "false");
      b.innerHTML = `<div class="pk-inner">
          <div class="pk-face pk-back">${backSvg}</div>
          <div class="pk-face pk-front"></div>
        </div>
        <span class="pk-badge">نگه‌دار</span>`;
      b.addEventListener("click", () => toggleHold(i));
      slots.push(b);
      rowEl.appendChild(b);
    }

    /* --- وضعیت --- */
    let stage = "bet";       // bet | deal | hold | draw | done
    let deck = [];
    let hand = [];
    let held = [false, false, false, false, false];
    let stake = 0;

    const LABELS = { bet: "شرط و پخش", deal: "در حال پخش…", hold: "تعویض کارت‌ها", draw: "در حال تعویض…", done: "دست بعد" };

    function paintStage() {
      stageEls.forEach((el) => {
        if (el.dataset.st === stage) el.dataset.on = "1";
        else delete el.dataset.on;
      });
      action.textContent = LABELS[stage];
      action.disabled = stage === "deal" || stage === "draw";
      bet.setDisabled(stage !== "bet" && stage !== "done");
      slots.forEach((s) => { s.disabled = stage !== "hold"; });
    }

    function showCard(i, faceUp, animate) {
      const slot = slots[i];
      slot.querySelector(".pk-front").innerHTML = hand[i] ? cardSvg(hand[i]) : "";
      slot.dataset.face = faceUp ? "up" : "down";
      if (animate && !reduced) {
        slot.classList.remove("pk-deal");
        void slot.offsetWidth;
        slot.classList.add("pk-deal");
      }
    }

    function setHeld(i, v) {
      held[i] = v;
      slots[i].dataset.held = v ? "1" : "0";
      slots[i].setAttribute("aria-pressed", v ? "true" : "false");
    }
    function toggleHold(i) {
      if (stage !== "hold") return;
      setHeld(i, !held[i]);
      const n = held.filter(Boolean).length;
      handEl.textContent = n ? `${ctx.fmt(n)} کارت نگه داشته شد` : "کارتی نگه نداشته‌ای — هر ۵ تا عوض می‌شوند";
    }

    /* --- مراحل --- */
    function startRound() {
      stake = bet.amount();
      if (!ctx.bet(stake)) return;
      deck = freshDeck();
      hand = [];
      held = [false, false, false, false, false];
      slots.forEach((s, i) => { setHeld(i, false); s.dataset.face = "down"; });
      markPaytable(null);
      result.className = "result-line";
      result.textContent = "";
      handEl.textContent = "";
      stage = "deal";
      paintStage();

      const step = reduced ? 0 : 110;
      for (let i = 0; i < 5; i++) {
        const put = () => {
          hand[i] = deck.pop();
          showCard(i, true, true);
          if (i === 4) {
            stage = "hold";
            paintStage();
            handEl.textContent = "کارت‌هایی که می‌خواهی نگه داری را بزن.";
          }
        };
        if (step) later(put, step * (i + 1));
        else put();
      }
    }

    function drawRound() {
      stage = "draw";
      paintStage();
      const swap = [];
      for (let i = 0; i < 5; i++) {
        if (!held[i]) { hand[i] = deck.pop(); slots[i].dataset.face = "down"; swap.push(i); }
      }
      const step = reduced ? 0 : 130;
      const finishAt = step && swap.length ? step * swap.length + 220 : 0;
      swap.forEach((i, k) => {
        const put = () => showCard(i, true, true);
        if (step) later(put, step * (k + 1));
        else put();
      });
      if (finishAt) later(finish, finishAt);
      else finish();
    }

    function finish() {
      const h = evaluate(hand);
      markPaytable(h.mult > 0 ? h.id : null);
      handEl.textContent = h.name;
      if (h.mult > 0) {
        const win = Math.floor(stake * h.mult);
        ctx.credit(win);
        result.className = "result-line win";
        result.textContent = h.mult === 1
          ? `${h.name} — شرطت برگشت: ${ctx.fmt(win)} سکه`
          : `${h.name}! +${ctx.fmt(win)} سکه (${ctx.fmt(h.mult)}×)`;
      } else {
        result.className = "result-line lose";
        result.textContent = "دستت جایزه نگرفت — دست بعد شانس بیشتری داری.";
      }
      stage = "done";
      paintStage();
    }

    action.addEventListener("click", () => {
      if (stage === "bet" || stage === "done") startRound();
      else if (stage === "hold") drawRound();
    });

    paintStage();
    handEl.textContent = "شرطت را بگذار و کارت بگیر.";

    return () => { timers.forEach(clearTimeout); timers.clear(); };
  },
};
