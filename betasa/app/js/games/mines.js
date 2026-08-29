/* ماین‌ها — جواهر پیدا کن، از بمب دور بمان */
import { betControls } from "../app.js";

const FA = "۰۱۲۳۴۵۶۷۸۹";
const faNum = (s) => String(s).replace(/[0-9]/g, (d) => FA[+d]);

export default {
  id: "mines",
  name: "ماین‌ها",
  desc: "جواهر جمع کن؛ به بمب نخور و به‌موقع برداشت کن.",
  icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5">
    <circle cx="20" cy="28" r="11"/>
    <path d="M28 20 L36 12 M33 9 l6 6 M20 22 v12 M14 28 h12" opacity=".6"/>
  </svg>`,

  render(root, ctx) {
    root.innerHTML = `
      <p class="muted" style="text-align:center">تعداد بمب را انتخاب کن، شرط ببند و خانه‌ها را باز کن. هر جواهر ضریب را بالا می‌برد.</p>
      <div class="mn-mines" style="display:flex;gap:8px;justify-content:center;margin:10px 0"></div>`;
    const bet = betControls(100);
    root.appendChild(bet.el);

    const info = document.createElement("div");
    info.className = "mono";
    info.style.cssText = "display:flex;justify-content:space-between;margin:10px 2px;color:var(--gold)";
    root.appendChild(info);

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:8px 0";
    root.appendChild(grid);

    const actions = document.createElement("div");
    actions.innerHTML = `
      <button class="btn btn-gold btn-block" data-a="start" type="button">شروع بازی</button>
      <button class="btn btn-turq btn-block" data-a="cash" type="button" hidden>برداشت</button>`;
    root.appendChild(actions);
    const startBtn = actions.querySelector('[data-a="start"]');
    const cashBtn = actions.querySelector('[data-a="cash"]');

    const result = document.createElement("div");
    result.className = "result-line";
    root.appendChild(result);

    let mineCount = 3, playing = false, mines = new Set(), picks = 0, mult = 1, stake = 0;

    const minesRow = root.querySelector(".mn-mines");
    [3, 5, 10].forEach((m) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn";
      b.textContent = `${ctx.fmt(m)} بمب`;
      b.style.cssText = "padding:6px 14px;border:1px solid var(--line);background:var(--surface-2)";
      b.addEventListener("click", () => {
        if (playing) return;
        mineCount = m;
        paintMineBtns();
      });
      minesRow.appendChild(b);
    });
    function paintMineBtns() {
      [...minesRow.children].forEach((b, i) => {
        const sel = [3, 5, 10][i] === mineCount;
        b.style.borderColor = sel ? "var(--gold)" : "var(--line)";
        b.style.background = sel ? "var(--gold-soft)" : "var(--surface-2)";
      });
    }
    paintMineBtns();

    const tiles = [];
    for (let i = 0; i < 25; i++) {
      const t = document.createElement("button");
      t.type = "button";
      t.disabled = true;
      t.style.cssText =
        "aspect-ratio:1;border-radius:10px;border:1px solid var(--line);background:var(--surface-2);font-size:1.3rem;cursor:pointer";
      t.addEventListener("click", () => pick(i));
      tiles.push(t);
      grid.appendChild(t);
    }

    function stepMult(k, m) {
      let p = 1;
      for (let i = 0; i < k; i++) p *= (0.99 * (25 - i)) / (25 - m - i);
      return p;
    }
    function updateInfo() {
      info.innerHTML = playing
        ? `<span>ضریب: ${faNum(mult.toFixed(2))}×</span><span>برداشت: ${ctx.fmt(Math.floor(stake * mult))} سکه</span>`
        : "";
      cashBtn.textContent = playing && picks > 0 ? `برداشت ${ctx.fmt(Math.floor(stake * mult))} سکه` : "برداشت";
      cashBtn.disabled = !playing || picks === 0;
    }

    function resetTiles() {
      tiles.forEach((t) => {
        t.textContent = "";
        t.disabled = !playing;
        t.style.background = "var(--surface-2)";
        t.style.borderColor = "var(--line)";
      });
    }

    startBtn.addEventListener("click", () => {
      if (playing) return;
      stake = bet.amount();
      if (!ctx.bet(stake)) return;
      playing = true; picks = 0; mult = 1;
      mines = new Set();
      while (mines.size < mineCount) mines.add(Math.floor(Math.random() * 25));
      bet.setDisabled(true);
      startBtn.hidden = true;
      cashBtn.hidden = false;
      result.className = "result-line";
      result.textContent = "";
      resetTiles();
      updateInfo();
    });

    function endRound() {
      playing = false;
      tiles.forEach((t) => (t.disabled = true));
      bet.setDisabled(false);
      startBtn.hidden = false;
      cashBtn.hidden = true;
    }

    function pick(i) {
      if (!playing || tiles[i].textContent) return;
      const t = tiles[i];
      if (mines.has(i)) {
        mines.forEach((j) => {
          tiles[j].textContent = "💣";
          tiles[j].style.background = "color-mix(in srgb, var(--danger) 18%, var(--surface-2))";
          tiles[j].style.borderColor = "var(--danger)";
        });
        result.className = "result-line lose";
        result.textContent = "بمب! همهٔ سکه‌های این دست سوخت.";
        endRound();
        return;
      }
      t.textContent = "💎";
      t.style.background = "var(--turq-soft)";
      t.style.borderColor = "var(--turq)";
      picks++;
      mult = stepMult(picks, mineCount);
      updateInfo();
      if (picks === 25 - mineCount) cashOut();
    }

    function cashOut() {
      const win = Math.floor(stake * mult);
      ctx.credit(win);
      result.className = "result-line win";
      result.textContent = `برداشت شد: +${ctx.fmt(win)} سکه (${faNum(mult.toFixed(2))}×)`;
      endRound();
    }
    cashBtn.addEventListener("click", () => { if (playing && picks > 0) cashOut(); });

    updateInfo();
  },
};
