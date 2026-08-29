/* تاس — عدد زیر هدف بیاید، برنده‌ای */
import { betControls } from "../ui.js";

const FA = "۰۱۲۳۴۵۶۷۸۹";
const faDigits = (s) => String(s).replace(/[0-9]/g, (d) => FA[+d]);

export default {
  id: "dice",
  name: "تاس",
  desc: "هدف را انتخاب کن؛ عدد زیر هدف یعنی برد.",
  icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5">
    <rect x="9" y="9" width="30" height="30" rx="6"/>
    <circle cx="17" cy="17" r="2" fill="currentColor"/>
    <circle cx="31" cy="17" r="2" fill="currentColor"/>
    <circle cx="24" cy="24" r="2" fill="currentColor"/>
    <circle cx="17" cy="31" r="2" fill="currentColor"/>
    <circle cx="31" cy="31" r="2" fill="currentColor"/>
  </svg>`,

  render(root, ctx) {
    root.innerHTML = `
      <div style="text-align:center">
        <div id="dc-roll" class="mono" style="font-size:3.4rem;font-weight:700;min-height:1.3em">—</div>
        <p class="muted">اگر عدد تصادفی (۰ تا ۹۹٫۹۹) کمتر از هدف باشد، می‌بری.</p>
      </div>
      <div style="margin:14px 0">
        <input id="dc-range" type="range" min="2" max="98" value="50" style="width:100%" aria-label="هدف">
        <div style="display:flex;justify-content:space-between;margin-top:8px">
          <span class="muted">هدف: <b id="dc-target" class="mono"></b></span>
          <span class="muted">شانس برد: <b id="dc-chance" class="mono"></b></span>
          <span class="muted">ضریب: <b id="dc-mult" class="mono"></b></span>
        </div>
      </div>`;
    const bet = betControls(100);
    root.appendChild(bet.el);

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "btn btn-gold btn-block";
    playBtn.textContent = "بریز تاس";
    root.appendChild(playBtn);

    const result = document.createElement("div");
    result.className = "result-line";
    root.appendChild(result);

    const range = root.querySelector("#dc-range");
    const rollEl = root.querySelector("#dc-roll");
    const targetEl = root.querySelector("#dc-target");
    const chanceEl = root.querySelector("#dc-chance");
    const multEl = root.querySelector("#dc-mult");

    function mult() { return 99 / +range.value; }
    function updateInfo() {
      const t = +range.value;
      targetEl.textContent = ctx.fmt(t);
      chanceEl.textContent = `${faDigits(t)}٪`;
      multEl.textContent = `×${faDigits(mult().toFixed(2))}`;
    }
    range.addEventListener("input", updateInfo);
    updateInfo();

    let timer = null;
    let playing = false;

    playBtn.addEventListener("click", () => {
      if (playing) return;
      const amount = bet.amount();
      if (!ctx.bet(amount)) return;
      playing = true;
      bet.setDisabled(true);
      playBtn.disabled = true;
      range.disabled = true;
      result.className = "result-line";
      result.textContent = "…";

      const roll = Math.floor(Math.random() * 10000) / 100; // 0..99.99
      const start = performance.now();
      const dur = 700;
      clearInterval(timer);
      timer = setInterval(() => {
        const p = Math.min(1, (performance.now() - start) / dur);
        const shown = p < 1 ? roll * p : roll;
        rollEl.textContent = faDigits(shown.toFixed(2));
        if (p >= 1) {
          clearInterval(timer);
          timer = null;
          const won = roll < +range.value;
          if (won) {
            const payout = Math.floor(amount * mult());
            ctx.credit(payout);
            result.className = "result-line win";
            result.textContent = `بردی! +${ctx.fmt(payout)} سکه`;
          } else {
            result.className = "result-line lose";
            result.textContent = "این بار نشد.";
          }
          playing = false;
          bet.setDisabled(false);
          playBtn.disabled = false;
          range.disabled = false;
        }
      }, 40);
    });

    return () => { if (timer) clearInterval(timer); };
  },
};
