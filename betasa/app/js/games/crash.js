/* کرش — ضریب بالا می‌رود؛ قبل از کرش برداشت کن */
import { betControls } from "../app.js";

const FA = "۰۱۲۳۴۵۶۷۸۹";
const faDec = (n, d = 2) =>
  n.toFixed(d).replace(".", "٫").replace(/[0-9]/g, (x) => FA[+x]);

/* نقطهٔ کرش: max(1, 0.99/(1-U))، سقف ۱۰۰۰ — حدود ۱٪ کرش آنی (۱٫۰۰) */
function sampleCrash() {
  const u = Math.random();
  return Math.min(1000, Math.max(1, 0.99 / (1 - u)));
}

export default {
  id: "crash",
  name: "کرش",
  desc: "ضریب بالا می‌رود؛ قبل از کرش برداشت کن.",
  icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5">
    <path d="M6 40 L6 8 M6 40 L42 40"/>
    <path d="M8 38 C 20 36, 28 28, 36 12" opacity=".8"/>
    <path d="M36 12 l-2 8 M36 12 l-8 2" opacity=".6"/>
  </svg>`,

  render(root, ctx) {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.innerHTML = `
      <div style="text-align:center">
        <div id="cr-mult" class="mono" style="font-size:3.2rem;line-height:1.3;font-weight:700">${faDec(1)}×</div>
        <svg id="cr-chart" viewBox="0 0 200 80" style="width:100%;max-width:360px;height:90px;display:${reduced ? "none" : "block"};margin:4px auto"
             fill="none" aria-hidden="true">
          <line x1="0" y1="78" x2="200" y2="78" stroke="var(--line)" stroke-width="1"/>
          <polyline id="cr-line" points="" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        <p class="muted">شرط ببند، ضریب بالا می‌رود؛ هر لحظه ممکن است کرش کند!</p>
      </div>`;
    const bet = betControls(100);
    root.appendChild(bet.el);

    const startBtn = document.createElement("button");
    startBtn.className = "btn btn-gold btn-block";
    startBtn.type = "button";
    startBtn.textContent = "شروع";
    root.appendChild(startBtn);

    const result = document.createElement("div");
    result.className = "result-line";
    root.appendChild(result);

    const multEl = root.querySelector("#cr-mult");
    const lineEl = root.querySelector("#cr-line");
    let raf = 0, running = false, cashed = false, amount = 0;
    let start = 0, crashAt = 1, lastDraw = 0;
    const pts = [];

    const multAt = (t) => Math.pow(1.06, t * 3); // t بر حسب ثانیه

    function endRound(crashed, mult) {
      running = false;
      cancelAnimationFrame(raf);
      startBtn.textContent = "شروع";
      bet.setDisabled(false);
      if (crashed) {
        multEl.style.color = "var(--danger)";
        lineEl.setAttribute("stroke", "var(--danger)");
        multEl.textContent = `${faDec(mult)}×`;
        if (!cashed) {
          result.className = "result-line lose";
          result.textContent = `کرش! در ${faDec(mult)}× — سکه‌ها سوخت.`;
        }
      }
    }

    function frame(now) {
      if (!running) return;
      const t = (now - start) / 1000;
      const m = multAt(t);
      if (m >= crashAt) { endRound(true, crashAt); return; }
      if (reduced) {
        if (now - lastDraw > 100) { lastDraw = now; multEl.textContent = `${faDec(m)}×`; }
      } else {
        multEl.textContent = `${faDec(m)}×`;
        const x = Math.min(200, t * 24);
        const y = 78 - Math.min(76, (m - 1) * 18);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        lineEl.setAttribute("points", pts.join(" "));
      }
      raf = requestAnimationFrame(frame);
    }

    startBtn.addEventListener("click", () => {
      if (running) {
        // برداشت
        if (cashed) return;
        cashed = true;
        const m = Math.min(multAt((performance.now() - start) / 1000), crashAt);
        const winnings = Math.floor(amount * m);
        ctx.credit(winnings);
        result.className = "result-line win";
        result.textContent = `برداشت در ${faDec(m)}× — +${ctx.fmt(winnings)} سکه`;
        startBtn.disabled = true;
        return;
      }
      amount = bet.amount();
      if (!ctx.bet(amount)) return;
      running = true; cashed = false;
      crashAt = sampleCrash();
      pts.length = 0;
      lineEl.setAttribute("points", "");
      lineEl.setAttribute("stroke", "var(--gold)");
      multEl.style.color = "";
      result.className = "result-line";
      result.textContent = "";
      bet.setDisabled(true);
      startBtn.disabled = false;
      startBtn.textContent = "برداشت";
      start = performance.now(); lastDraw = 0;
      raf = requestAnimationFrame(frame);
    });

    // پایان راند حتی بعد از برداشت باید برسد
    const watch = setInterval(() => {
      if (running && cashed) startBtn.disabled = true;
      if (!running && startBtn.disabled) startBtn.disabled = false;
    }, 200);

    return () => { cancelAnimationFrame(raf); clearInterval(watch); running = false; };
  },
};
