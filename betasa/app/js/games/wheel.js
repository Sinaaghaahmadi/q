/* گردونه شانس — بچرخان و ضریبت را بگیر */
import { betControls } from "../app.js";

const FA = "۰۱۲۳۴۵۶۷۸۹";
const faDigits = (s) => String(s).replace(/[0-9]/g, (d) => FA[+d]);

/* ۱۲ قطاع؛ مجموع ضرایب ۱۱٫۷ → بازگشت ≈۹۷٪ */
const SEGS = [0, 1.2, 0, 2, 0, 1.5, 0, 5, 0, 2, 0, 0];

function segColor(m) {
  if (m === 0) return "var(--danger)";
  if (m >= 5) return "var(--gold)";
  if (m >= 2) return "var(--turq)";
  return "var(--win)";
}

export default {
  id: "wheel",
  name: "گردونه شانس",
  desc: "گردونه را بچرخان؛ تا ۵ برابر ببر.",
  icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5">
    <circle cx="24" cy="26" r="16"/>
    <path d="M24 10 v32 M8 26 h32 M13 15 l22 22 M35 15 l-22 22" opacity=".6"/>
    <path d="M21 3 h6 l-3 6 z" fill="currentColor"/>
  </svg>`,

  render(root, ctx) {
    const R = 90;
    let wedges = "";
    let labels = "";
    for (let i = 0; i < 12; i++) {
      const a0 = ((i * 30 - 90) * Math.PI) / 180;
      const a1 = (((i + 1) * 30 - 90) * Math.PI) / 180;
      const x0 = 100 + R * Math.cos(a0), y0 = 100 + R * Math.sin(a0);
      const x1 = 100 + R * Math.cos(a1), y1 = 100 + R * Math.sin(a1);
      wedges += `<path d="M100 100 L${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z"
        fill="${segColor(SEGS[i])}" fill-opacity="${SEGS[i] === 0 ? 0.25 : 0.55}" stroke="var(--line)"/>`;
      const am = ((i * 30 + 15 - 90) * Math.PI) / 180;
      const lx = 100 + R * 0.68 * Math.cos(am), ly = 100 + R * 0.68 * Math.sin(am);
      labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle"
        font-size="11" fill="currentColor">×${faDigits(String(SEGS[i]))}</text>`;
    }
    root.innerHTML = `
      <div style="text-align:center">
        <div style="position:relative;display:inline-block">
          <div style="position:absolute;top:-4px;left:50%;transform:translateX(-50%);color:var(--gold);font-size:1.4rem;z-index:1" aria-hidden="true">▼</div>
          <svg width="240" height="240" viewBox="0 0 200 200" aria-hidden="true">
            <g id="wh-rotor" style="transform-origin:100px 100px">${wedges}${labels}
              <circle cx="100" cy="100" r="14" fill="var(--surface-2)" stroke="var(--line)"/>
            </g>
          </svg>
        </div>
        <p class="muted">شرط ببند و گردونه را بچرخان.</p>
      </div>`;
    const bet = betControls(100);
    root.appendChild(bet.el);

    const spinBtn = document.createElement("button");
    spinBtn.type = "button";
    spinBtn.className = "btn btn-gold btn-block";
    spinBtn.textContent = "بچرخان";
    root.appendChild(spinBtn);

    const result = document.createElement("div");
    result.className = "result-line";
    root.appendChild(result);

    const rotor = root.querySelector("#wh-rotor");
    let angle = 0;
    let spinning = false;
    let timer = null;

    function settle(amount, idx) {
      const m = SEGS[idx];
      if (m > 0) {
        const payout = Math.floor(amount * m);
        ctx.credit(payout);
        result.className = "result-line win";
        result.textContent = `×${faDigits(String(m))} — بردی! +${ctx.fmt(payout)} سکه`;
      } else {
        result.className = "result-line lose";
        result.textContent = "×۰ — این بار نشد.";
      }
      spinning = false;
      bet.setDisabled(false);
      spinBtn.disabled = false;
    }

    spinBtn.addEventListener("click", () => {
      if (spinning) return;
      const amount = bet.amount();
      if (!ctx.bet(amount)) return;
      spinning = true;
      bet.setDisabled(true);
      spinBtn.disabled = true;
      result.className = "result-line";
      result.textContent = "…";

      const idx = Math.floor(Math.random() * 12);
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const target = -(idx * 30 + 15); // مرکز قطاع زیر اشاره‌گر
      if (reduced) {
        rotor.style.transition = "none";
        angle = target;
        rotor.style.transform = `rotate(${angle}deg)`;
        settle(amount, idx);
        return;
      }
      const turns = 4 + Math.floor(Math.random() * 3);
      angle = angle - (((angle - target) % 360) + 360) % 360 - turns * 360;
      rotor.style.transition = "transform 3s cubic-bezier(.15,.6,.2,1)";
      rotor.style.transform = `rotate(${angle}deg)`;
      timer = setTimeout(() => { timer = null; settle(amount, idx); }, 3050);
    });

    return () => { if (timer) clearTimeout(timer); };
  },
};
