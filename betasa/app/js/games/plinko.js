/* پلینکو — توپ از میان میخ‌ها پایین می‌افتد؛ خانهٔ آخر ضریبت را تعیین می‌کند */
import { betControls } from "../ui.js";

const FA = "۰۱۲۳۴۵۶۷۸۹";
const faDec = (n) => {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(n < 1 ? 2 : 1).replace(/0$/, "");
  return s.replace(".", "٫").replace(/[0-9]/g, (x) => FA[+x]);
};

/* ضریب‌ها (۱۳ خانه، متقارن). بررسی RTP با وزن‌های دوجمله‌ای C(12,k)/4096:
   k:      0     1     2     3     4      5      6
   C:      1     12    66    220   495    792    924
   mult:   26    9     4     2     1.1    0.6    0.3
   C×mult: 26 + 108 + 264 + 440 + 544.5 + 475.2  (نیمهٔ چپ = 1857.7)
   جمع = 2×1857.7 + 924×0.3 = 3992.6 → RTP = 3992.6/4096 ≈ 0.9748 ≈ ٪۹۷ */
const MULTS = [26, 9, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 9, 26];
const ROWS = 12;

export default {
  id: "plinko",
  name: "پلینکو",
  desc: "توپ را رها کن؛ خانهٔ فرود ضریبت را می‌دهد.",
  icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5">
    <circle cx="24" cy="8" r="3.5"/>
    <g opacity=".6">
      <circle cx="24" cy="20" r="1.5"/><circle cx="17" cy="27" r="1.5"/><circle cx="31" cy="27" r="1.5"/>
      <circle cx="10" cy="34" r="1.5"/><circle cx="24" cy="34" r="1.5"/><circle cx="38" cy="34" r="1.5"/>
    </g>
    <path d="M8 42 L40 42"/>
  </svg>`,

  render(root, ctx) {
    const W = 260, SP = 18, TOP = 16, GAP = 16;
    const px = (off) => W / 2 + off * SP; // off بر حسب گام نیم‌واحدی
    let pegs = "";
    for (let i = 0; i < ROWS; i++)
      for (let j = 0; j <= i; j++)
        pegs += `<circle cx="${px(j - i / 2)}" cy="${TOP + (i + 1) * GAP}" r="2" fill="currentColor" opacity=".45"/>`;
    let slots = "";
    for (let k = 0; k < 13; k++) {
      const x = px(k - 6);
      const hot = MULTS[k] >= 2;
      slots += `<rect x="${x - 8}" y="${TOP + 13 * GAP + 4}" width="16" height="16" rx="4"
                  fill="var(--surface-2)" stroke="${hot ? "var(--gold)" : "var(--line)"}"/>
        <text x="${x}" y="${TOP + 13 * GAP + 15}" text-anchor="middle" font-size="6.5"
              fill="${hot ? "var(--gold)" : "currentColor"}">${faDec(MULTS[k])}</text>`;
    }
    root.innerHTML = `
      <svg viewBox="0 0 ${W} ${TOP + 13 * GAP + 26}" style="width:100%;max-width:380px;display:block;margin:0 auto" aria-hidden="true">
        ${pegs}${slots}
        <circle id="pk-ball" cx="${W / 2}" cy="${TOP}" r="5" fill="var(--turq)" hidden></circle>
      </svg>
      <p class="muted" style="text-align:center">توپ ۱۲ ردیف میخ را رد می‌کند؛ خانهٔ فرود ضریب برد است.</p>`;
    const bet = betControls(100);
    root.appendChild(bet.el);

    const dropBtn = document.createElement("button");
    dropBtn.className = "btn btn-turq btn-block";
    dropBtn.type = "button";
    dropBtn.textContent = "رها کن";
    root.appendChild(dropBtn);

    const result = document.createElement("div");
    result.className = "result-line";
    root.appendChild(result);

    const ball = root.querySelector("#pk-ball");
    let raf = 0, running = false;

    function settle(amount, slot) {
      const mult = MULTS[slot];
      const winnings = Math.floor(amount * mult);
      if (winnings > 0) ctx.credit(winnings);
      const won = winnings >= amount;
      result.className = "result-line " + (won ? "win" : "lose");
      result.textContent = won
        ? `ضریب ${faDec(mult)}× — +${ctx.fmt(winnings)} سکه!`
        : `ضریب ${faDec(mult)}× — ${winnings > 0 ? `فقط ${ctx.fmt(winnings)} سکه برگشت.` : "سکه‌ها سوخت."}`;
      running = false;
      bet.setDisabled(false);
      dropBtn.disabled = false;
    }

    dropBtn.addEventListener("click", () => {
      if (running) return;
      const amount = bet.amount();
      if (!ctx.bet(amount)) return;
      running = true;
      bet.setDisabled(true);
      dropBtn.disabled = true;
      result.className = "result-line";
      result.textContent = "";

      // مسیر: ۱۲ گام چپ/راست
      const steps = Array.from({ length: ROWS }, () => (Math.random() < 0.5 ? -1 : 1));
      const slot = steps.filter((s) => s > 0).length; // 0..12
      const xs = [0]; // آفست نیم‌گامی در هر ردیف
      for (const s of steps) xs.push(xs[xs.length - 1] + s / 2);

      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        ball.hidden = false;
        ball.setAttribute("cx", px(xs[ROWS]));
        ball.setAttribute("cy", TOP + 13 * GAP + 8);
        settle(amount, slot);
        return;
      }

      ball.hidden = false;
      const perRow = 130; // میلی‌ثانیه برای هر ردیف
      const start = performance.now();
      function step(now) {
        const t = (now - start) / perRow; // ردیف اعشاری
        const i = Math.min(ROWS, Math.floor(t));
        const f = Math.min(1, t - i);
        const x0 = xs[Math.min(i, ROWS)];
        const x1 = xs[Math.min(i + 1, ROWS)];
        // پرش کوچک بین دو میخ
        const bounce = Math.sin(f * Math.PI) * -3;
        ball.setAttribute("cx", px(x0 + (x1 - x0) * f));
        ball.setAttribute("cy", TOP + Math.min(t + 1, 13) * GAP + bounce + (t >= ROWS ? 8 : 0));
        if (t < ROWS + 0.4) raf = requestAnimationFrame(step);
        else {
          ball.setAttribute("cx", px(xs[ROWS]));
          ball.setAttribute("cy", TOP + 13 * GAP + 8);
          settle(amount, slot);
        }
      }
      raf = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(raf);
  },
};
