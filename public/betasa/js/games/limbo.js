/* لیمبو — ضریب هدف تعیین کن؛ اگر نتیجه بالاتر آمد، بردی */
import { betControls } from "../ui.js";

const FA = "۰۱۲۳۴۵۶۷۸۹";
const faDec = (n, d = 2) =>
  n.toFixed(d).replace(".", "٫").replace(/[0-9]/g, (x) => FA[+x]);

/* همان توزیع کرش: 0.99/(1-U) با سقف ۱۰۰۰ */
function sampleResult() {
  const u = Math.random();
  return Math.min(1000, Math.max(1, 0.99 / (1 - u)));
}

export default {
  id: "limbo",
  name: "لیمبو",
  desc: "ضریب هدف بگذار؛ نتیجه بالاتر بیاید، بردی.",
  icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5">
    <path d="M8 34 L40 34"/>
    <path d="M10 34 L24 10 L38 34" opacity=".7"/>
    <circle cx="24" cy="10" r="3.5"/>
    <path d="M14 40 L34 40" opacity=".5"/>
  </svg>`,

  render(root, ctx) {
    root.innerHTML = `
      <div style="text-align:center">
        <div id="lb-num" class="mono" style="font-size:3.2rem;line-height:1.3;font-weight:700">${faDec(1)}×</div>
        <p class="muted">اگر نتیجه از ضریب هدف بیشتر یا مساوی باشد، شرط × هدف می‌گیری.</p>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin:10px 0">
        <label class="muted" for="lb-target" style="white-space:nowrap">ضریب هدف</label>
        <input id="lb-target" class="bet-input mono" inputmode="decimal" value="2" aria-label="ضریب هدف"
               style="flex:1;background:var(--surface-2);border:1px solid var(--line)">
        <span id="lb-prob" class="muted mono" style="white-space:nowrap"></span>
      </div>`;
    const bet = betControls(100);
    root.appendChild(bet.el);

    const playBtn = document.createElement("button");
    playBtn.className = "btn btn-turq btn-block";
    playBtn.type = "button";
    playBtn.textContent = "بازی";
    root.appendChild(playBtn);

    const result = document.createElement("div");
    result.className = "result-line";
    root.appendChild(result);

    const numEl = root.querySelector("#lb-num");
    const targetEl = root.querySelector("#lb-target");
    const probEl = root.querySelector("#lb-prob");

    function target() {
      const t = parseFloat(targetEl.value);
      if (!Number.isFinite(t)) return NaN;
      return Math.min(1000, Math.max(1.01, t));
    }
    function updateProb() {
      const t = target();
      probEl.textContent = Number.isFinite(t) ? `شانس برد: ٪${faDec(99 / t, 2)}` : "";
    }
    targetEl.addEventListener("input", updateProb);
    updateProb();

    let raf = 0, running = false;

    playBtn.addEventListener("click", () => {
      if (running) return;
      const t = target();
      if (!Number.isFinite(t)) { ctx.toast("ضریب هدف معتبر نیست"); return; }
      targetEl.value = t;
      updateProb();
      const amount = bet.amount();
      if (!ctx.bet(amount)) return;
      running = true;
      bet.setDisabled(true);
      playBtn.disabled = true;
      targetEl.disabled = true;
      result.className = "result-line";
      result.textContent = "";
      numEl.style.color = "";

      const final = sampleResult();
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const dur = reduced ? 0 : 600;
      const start = performance.now();

      function finish() {
        const won = final >= t;
        numEl.textContent = `${faDec(final)}×`;
        if (won) {
          const winnings = Math.floor(amount * t);
          ctx.credit(winnings);
          numEl.style.color = "var(--win)";
          result.className = "result-line win";
          result.textContent = `نتیجه ${faDec(final)}× — بردی! +${ctx.fmt(winnings)} سکه`;
        } else {
          numEl.style.color = "var(--danger)";
          result.className = "result-line lose";
          result.textContent = `نتیجه ${faDec(final)}× از ${faDec(t)} کمتر بود — این بار نشد.`;
        }
        running = false;
        bet.setDisabled(false);
        playBtn.disabled = false;
        targetEl.disabled = false;
      }

      if (dur === 0) { finish(); return; }
      function step(now) {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        numEl.textContent = `${faDec(1 + (final - 1) * eased)}×`;
        if (p < 1) raf = requestAnimationFrame(step);
        else finish();
      }
      raf = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(raf);
  },
};
