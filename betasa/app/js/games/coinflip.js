/* شیر یا خط — نمونهٔ مرجع رابط ماژول بازی */
import { betControls } from "../ui.js";

export default {
  id: "coinflip",
  name: "شیر یا خط",
  desc: "سکه بینداز؛ حدس درست، دوبرابر می‌گیری.",
  icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5">
    <circle cx="24" cy="24" r="16"/>
    <path d="M24 14 v20 M17 20 c0 -4 14 -4 14 0 c0 4 -14 4 -14 8 c0 4 14 4 14 0" opacity=".6"/>
  </svg>`,

  render(root, ctx) {
    root.innerHTML = `
      <div style="text-align:center">
        <div id="cf-coin" style="font-size:4.2rem;line-height:1.2" aria-hidden="true">🪙</div>
        <p class="muted">شیر یا خط را انتخاب کن — برد یعنی ۲ برابر سکه‌ات.</p>
      </div>`;
    const bet = betControls(100);
    root.appendChild(bet.el);

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px";
    row.innerHTML = `
      <button class="btn btn-gold btn-block" data-side="heads" type="button">شیر</button>
      <button class="btn btn-turq btn-block" data-side="tails" type="button">خط</button>`;
    root.appendChild(row);

    const result = document.createElement("div");
    result.className = "result-line";
    root.appendChild(result);

    const coinEl = root.querySelector("#cf-coin");
    let spinning = false;

    row.querySelectorAll("button").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (spinning) return;
        const amount = bet.amount();
        if (!ctx.bet(amount)) return;
        spinning = true;
        bet.setDisabled(true);
        result.className = "result-line";
        result.textContent = "…";
        coinEl.style.transition = "transform .9s cubic-bezier(.3,.7,.4,1)";
        coinEl.style.transform = "rotateX(1080deg)";

        setTimeout(() => {
          const outcome = Math.random() < 0.5 ? "heads" : "tails";
          const won = outcome === btn.dataset.side;
          coinEl.textContent = outcome === "heads" ? "🦁" : "🪙";
          if (won) {
            ctx.credit(amount * 2);
            result.className = "result-line win";
            result.textContent = `${outcome === "heads" ? "شیر" : "خط"} آمد — بردی! +${ctx.fmt(amount * 2)} سکه`;
          } else {
            result.className = "result-line lose";
            result.textContent = `${outcome === "heads" ? "شیر" : "خط"} آمد — این بار نشد.`;
          }
          coinEl.style.transition = "none";
          coinEl.style.transform = "none";
          spinning = false;
          bet.setDisabled(false);
        }, 950);
      })
    );
  },
};
