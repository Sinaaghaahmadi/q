/* برج — طبقه به طبقه بالا برو، به بمب نخور */
import { betControls } from "../app.js";

const FA = "۰۱۲۳۴۵۶۷۸۹";
const faNum = (s) => String(s).replace(/[0-9]/g, (d) => FA[+d]);
const ROWS = 8, COLS = 3, STEP = 0.99 * 3 / 2;

export default {
  id: "tower",
  name: "برج",
  desc: "طبقه‌به‌طبقه بالا برو؛ هر طبقه یک بمب دارد.",
  icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5">
    <path d="M16 42 h16 M18 42 V14 h12 v28 M14 14 h20 M24 6 l-6 8 h12 Z"/>
    <path d="M18 22 h12 M18 30 h12 M18 38 h12" opacity=".6"/>
  </svg>`,

  render(root, ctx) {
    root.innerHTML = `<p class="muted" style="text-align:center">در هر طبقه یکی از سه خانه بمب دارد. خانهٔ امن انتخاب کن و بالا برو؛ هر وقت خواستی برداشت کن.</p>`;
    const bet = betControls(100);
    root.appendChild(bet.el);

    const info = document.createElement("div");
    info.className = "mono";
    info.style.cssText = "display:flex;justify-content:space-between;margin:10px 2px;color:var(--gold)";
    root.appendChild(info);

    const towerWrap = document.createElement("div");
    towerWrap.style.cssText = "max-height:320px;overflow-y:auto;overflow-x:hidden;margin:8px 0;border:1px solid var(--line);border-radius:12px;padding:8px;background:var(--surface-2)";
    root.appendChild(towerWrap);

    const actions = document.createElement("div");
    actions.innerHTML = `
      <button class="btn btn-gold btn-block" data-a="start" type="button">شروع صعود</button>
      <button class="btn btn-turq btn-block" data-a="cash" type="button" hidden>برداشت</button>`;
    root.appendChild(actions);
    const startBtn = actions.querySelector('[data-a="start"]');
    const cashBtn = actions.querySelector('[data-a="cash"]');

    const result = document.createElement("div");
    result.className = "result-line";
    root.appendChild(result);

    let playing = false, level = 0, mult = 1, stake = 0, bombs = [];
    const rows = [];

    // ردیف‌ها از بالا به پایین رندر می‌شوند؛ صعود از پایین شروع می‌شود
    for (let r = ROWS - 1; r >= 0; r--) {
      const row = document.createElement("div");
      row.dataset.level = r;
      row.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:4px 0;padding:3px;border-radius:10px";
      for (let c = 0; c < COLS; c++) {
        const b = document.createElement("button");
        b.type = "button";
        b.disabled = true;
        b.style.cssText = "height:34px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);font-size:1rem;cursor:pointer";
        b.addEventListener("click", () => pick(r, c));
        row.appendChild(b);
      }
      towerWrap.appendChild(row);
      rows[r] = row;
    }

    function cells(r) { return [...rows[r].children]; }
    function paint() {
      for (let r = 0; r < ROWS; r++) {
        const cur = playing && r === level;
        rows[r].style.outline = cur ? "2px solid var(--gold)" : "none";
        cells(r).forEach((b) => (b.disabled = !cur));
      }
      info.innerHTML = playing
        ? `<span>طبقه: ${ctx.fmt(level + 1)}/${ctx.fmt(ROWS)} — ضریب: ${faNum(mult.toFixed(2))}×</span><span>برداشت: ${ctx.fmt(Math.floor(stake * mult))} سکه</span>`
        : "";
      cashBtn.textContent = `برداشت ${ctx.fmt(Math.floor(stake * mult))} سکه`;
      cashBtn.disabled = !playing || level === 0;
    }
    function resetCells() {
      for (let r = 0; r < ROWS; r++)
        cells(r).forEach((b) => {
          b.textContent = "";
          b.style.background = "var(--surface-2)";
          b.style.borderColor = "var(--line)";
        });
    }

    startBtn.addEventListener("click", () => {
      if (playing) return;
      stake = bet.amount();
      if (!ctx.bet(stake)) return;
      playing = true; level = 0; mult = 1;
      bombs = Array.from({ length: ROWS }, () => Math.floor(Math.random() * COLS));
      bet.setDisabled(true);
      startBtn.hidden = true;
      cashBtn.hidden = false;
      result.className = "result-line";
      result.textContent = "";
      resetCells();
      towerWrap.scrollTop = towerWrap.scrollHeight;
      paint();
    });

    function endRound() {
      playing = false;
      bet.setDisabled(false);
      startBtn.hidden = false;
      cashBtn.hidden = true;
      paint();
    }

    function pick(r, c) {
      if (!playing || r !== level) return;
      const cs = cells(r);
      if (c === bombs[r]) {
        cs[c].textContent = "💣";
        cs[c].style.background = "color-mix(in srgb, var(--danger) 18%, var(--surface-2))";
        cs[c].style.borderColor = "var(--danger)";
        result.className = "result-line lose";
        result.textContent = "بمب! صعود تمام شد و شرط سوخت.";
        endRound();
        return;
      }
      cs[c].textContent = "✅";
      cs[c].style.background = "var(--turq-soft)";
      cs[c].style.borderColor = "var(--turq)";
      mult *= STEP;
      level++;
      if (level === ROWS) { cashOut("قلهٔ برج! "); return; }
      rows[level].scrollIntoView({ block: "nearest" });
      paint();
    }

    function cashOut(prefix = "") {
      const win = Math.floor(stake * mult);
      ctx.credit(win);
      result.className = "result-line win";
      result.textContent = `${prefix}برداشت شد: +${ctx.fmt(win)} سکه (${faNum(mult.toFixed(2))}×)`;
      endRound();
    }
    cashBtn.addEventListener("click", () => { if (playing && level > 0) cashOut(); });

    paint();
  },
};
