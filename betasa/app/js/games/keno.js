/* کِنو — عدد انتخاب کن و منتظر قرعه باش */
import { betControls } from "../app.js";

const FA = "۰۱۲۳۴۵۶۷۸۹";
const faNum = (s) => String(s).replace(/[0-9]/g, (d) => FA[+d]);

const PAYTABLE = {
  1: { 1: 3.8 },
  2: { 2: 15 },
  3: { 2: 2, 3: 44 },
  4: { 2: 1.6, 3: 9, 4: 110 },
  5: { 3: 2, 4: 12, 5: 80 },
  6: { 3: 1.6, 4: 6, 5: 40, 6: 250 },
  7: { 4: 3, 5: 14, 6: 90, 7: 500 },
  8: { 4: 2, 5: 8, 6: 40, 7: 200, 8: 1000 },
  9: { 4: 1.6, 5: 5, 6: 20, 7: 100, 8: 500, 9: 2000 },
  10: { 5: 3, 6: 12, 7: 50, 8: 250, 9: 1000, 10: 4000 },
};

export default {
  id: "keno",
  name: "کِنو",
  desc: "تا ۱۰ عدد انتخاب کن؛ هرچه بیشتر بخوانند، بیشتر می‌بری.",
  icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5">
    <rect x="8" y="8" width="32" height="32" rx="6"/>
    <circle cx="18" cy="18" r="3" opacity=".6"/><circle cx="30" cy="18" r="3"/>
    <circle cx="18" cy="30" r="3"/><circle cx="30" cy="30" r="3" opacity=".6"/>
  </svg>`,

  render(root, ctx) {
    root.innerHTML = `<p class="muted" style="text-align:center">تا ۱۰ عدد از ۱ تا ۴۰ انتخاب کن، شرط ببند و منتظر ۱۰ عدد قرعه باش.</p>`;
    const bet = betControls(100);
    root.appendChild(bet.el);

    const info = document.createElement("div");
    info.className = "mono";
    info.style.cssText = "margin:10px 2px;color:var(--gold)";
    root.appendChild(info);

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(8,1fr);gap:5px;margin:8px 0";
    root.appendChild(grid);

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "btn btn-gold btn-block";
    playBtn.textContent = "شروع قرعه";
    root.appendChild(playBtn);

    const result = document.createElement("div");
    result.className = "result-line";
    root.appendChild(result);

    const picked = new Set();
    let drawn = new Set(), running = false;
    const timers = [];
    const cells = [];

    for (let n = 1; n <= 40; n++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mono";
      b.textContent = faNum(n);
      b.style.cssText = "aspect-ratio:1;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);cursor:pointer;font-size:.95rem";
      b.addEventListener("click", () => {
        if (running) return;
        if (picked.has(n)) picked.delete(n);
        else if (picked.size < 10) picked.add(n);
        else return ctx.toast("حداکثر ۱۰ عدد!");
        drawn = new Set();
        result.className = "result-line";
        result.textContent = "";
        paint();
      });
      cells[n] = b;
      grid.appendChild(b);
    }

    function paint() {
      for (let n = 1; n <= 40; n++) {
        const b = cells[n], p = picked.has(n), d = drawn.has(n);
        b.style.background = p && d ? "var(--gold-soft)" : p ? "var(--turq-soft)" : d ? "var(--surface-2)" : "var(--surface-2)";
        b.style.borderColor = p && d ? "var(--gold)" : p ? "var(--turq)" : d ? "var(--danger)" : "var(--line)";
        b.style.fontWeight = p || d ? "700" : "400";
      }
      const table = PAYTABLE[picked.size];
      const tbl = table
        ? Object.entries(table).map(([h, m]) => `${faNum(h)}→${faNum(m)}×`).join(" | ")
        : "";
      info.textContent = picked.size ? `انتخاب: ${ctx.fmt(picked.size)} — جدول: ${tbl}` : "عددی انتخاب نشده";
    }

    playBtn.addEventListener("click", () => {
      if (running) return;
      if (!picked.size) return ctx.toast("اول چند عدد انتخاب کن!");
      const stake = bet.amount();
      if (!ctx.bet(stake)) return;
      running = true;
      bet.setDisabled(true);
      playBtn.disabled = true;
      drawn = new Set();
      result.className = "result-line";
      result.textContent = "…";

      const pool = Array.from({ length: 40 }, (_, i) => i + 1);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const numbers = pool.slice(0, 10);
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

      function finish() {
        const hits = [...picked].filter((n) => drawn.has(n)).length;
        const mult = (PAYTABLE[picked.size] || {})[hits] || 0;
        if (mult > 0) {
          const win = Math.floor(stake * mult);
          ctx.credit(win);
          result.className = "result-line win";
          result.textContent = `${ctx.fmt(hits)} برخورد — بردی! +${ctx.fmt(win)} سکه (${faNum(mult)}×)`;
        } else {
          result.className = "result-line lose";
          result.textContent = `${ctx.fmt(hits)} برخورد — این بار نشد.`;
        }
        running = false;
        bet.setDisabled(false);
        playBtn.disabled = false;
      }

      if (reduced) {
        numbers.forEach((n) => drawn.add(n));
        paint();
        finish();
      } else {
        numbers.forEach((n, i) =>
          timers.push(setTimeout(() => {
            drawn.add(n);
            paint();
            if (i === numbers.length - 1) finish();
          }, 260 * (i + 1)))
        );
      }
    });

    paint();
    return () => timers.forEach(clearTimeout);
  },
};
