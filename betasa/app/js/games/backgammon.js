/* تخته نرد — بازی کامل با قواعد استاندارد در برابر ربات
   جهت حرکت: بازیکن از خانهٔ ۲۴ به سمت ۱ (خانهٔ خودش ۱ تا ۶)، ربات برعکس. */
import { betControls } from "../ui.js";

const FA = "۰۱۲۳۴۵۶۷۸۹";
const faNum = (s) => String(s).replace(/[0-9]/g, (d) => FA[+d]);

/* ---------- مدل قواعد (بدون DOM — قابل تست مستقل) ---------- */
export const P = 1;   // بازیکن
export const B = -1;  // ربات

const barPoint = (side) => (side > 0 ? 25 : 0);
const offPoint = (side) => (side > 0 ? 0 : 25);
/** فاصلهٔ یک خانه تا خروج، برای هر طرف */
const dist = (p, side) => (side > 0 ? p : 25 - p);

export function initialState() {
  const pts = new Array(25).fill(0);
  pts[24] = 2; pts[13] = 5; pts[8] = 3; pts[6] = 5;        // بازیکن (+)
  pts[1] = -2; pts[12] = -5; pts[17] = -3; pts[19] = -5;   // ربات (−)
  return { pts, bar: { 1: 0, "-1": 0 }, off: { 1: 0, "-1": 0 } };
}

export function cloneState(s) {
  return {
    pts: s.pts.slice(),
    bar: { 1: s.bar[1], "-1": s.bar[-1] },
    off: { 1: s.off[1], "-1": s.off[-1] },
  };
}

/** آیا هر ۱۵ مهره وارد خانه شده‌اند؟ (شرط بیرون بردن) */
export function allHome(s, side) {
  if (s.bar[side] > 0) return false;
  for (let p = 1; p <= 24; p++) {
    if (s.pts[p] * side > 0 && dist(p, side) > 6) return false;
  }
  return true;
}

function higherExists(s, side, d) {
  for (let k = d + 1; k <= 6; k++) {
    const p = side > 0 ? k : 25 - k;
    if (s.pts[p] * side > 0) return true;
  }
  return false;
}

/** همهٔ حرکت‌های مجاز یک تاس مشخص */
export function genMoves(s, side, die) {
  const out = [];
  const dir = side > 0 ? -1 : 1;
  const blocked = (i) => s.pts[i] * side <= -2;

  if (s.bar[side] > 0) {
    const to = barPoint(side) + dir * die;
    if (to >= 1 && to <= 24 && !blocked(to)) out.push({ from: barPoint(side), to, die });
    return out;
  }
  for (let i = 1; i <= 24; i++) {
    if (s.pts[i] * side <= 0) continue;
    const to = i + dir * die;
    if (to >= 1 && to <= 24 && !blocked(to)) out.push({ from: i, to, die });
  }
  if (allHome(s, side)) {
    for (let i = 1; i <= 24; i++) {
      if (s.pts[i] * side <= 0) continue;
      const d = dist(i, side);
      if (d === die || (d < die && !higherExists(s, side, d)))
        out.push({ from: i, to: offPoint(side), die });
    }
  }
  return out;
}

export function isHit(s, side, mv) {
  return mv.to >= 1 && mv.to <= 24 && s.pts[mv.to] * side === -1;
}

export function applyMove(s, side, mv) {
  const n = cloneState(s);
  if (mv.from === barPoint(side)) n.bar[side]--;
  else n.pts[mv.from] -= side;
  if (mv.to === offPoint(side)) {
    n.off[side]++;
  } else {
    if (n.pts[mv.to] * side === -1) { n.pts[mv.to] = 0; n.bar[-side]++; }
    n.pts[mv.to] += side;
  }
  return n;
}

function stateKey(s) {
  return s.pts.join(",") + "|" + s.bar[1] + "," + s.bar[-1] + "|" + s.off[1] + "," + s.off[-1];
}

/** بیشترین تعداد حرکتِ قابل بازی از این وضعیت (با یادداشت‌برداری) */
export function maxDepth(state, side, dice, memo = new Map()) {
  if (!dice.length) return 0;
  const key = side + "#" + stateKey(state) + "#" + dice.slice().sort().join("");
  const seen = memo.get(key);
  if (seen !== undefined) return seen;
  let best = 0;
  const tried = new Set();
  for (let i = 0; i < dice.length; i++) {
    const d = dice[i];
    if (tried.has(d)) continue;
    tried.add(d);
    const rest = dice.slice(0, i).concat(dice.slice(i + 1));
    for (const mv of genMoves(state, side, d)) {
      const v = 1 + maxDepth(applyMove(state, side, mv), side, rest, memo);
      if (v > best) best = v;
      if (best === dice.length) { memo.set(key, best); return best; }
    }
  }
  memo.set(key, best);
  return best;
}
export const maxPlayable = (state, side, dice) => maxDepth(state, side, dice);

/** پیپ‌کانت (مجموع فاصلهٔ مهره‌ها تا خروج) */
export function pip(s, side) {
  let t = s.bar[side] * 25;
  for (let p = 1; p <= 24; p++) if (s.pts[p] * side > 0) t += Math.abs(s.pts[p]) * dist(p, side);
  return t;
}

/** نتیجهٔ برد: ساده / مارس / مارس ترکی */
export function outcome(state, winner) {
  const loser = -winner;
  if (state.off[loser] > 0) return { mult: 2, kind: "برد ساده" };
  const home = winner > 0 ? [1, 2, 3, 4, 5, 6] : [19, 20, 21, 22, 23, 24];
  const deep = state.bar[loser] > 0 || home.some((p) => state.pts[p] * loser > 0);
  return deep ? { mult: 4, kind: "مارس ترکی" } : { mult: 3, kind: "مارس" };
}

/* ---------- ارزیابی ربات ---------- */
function evaluate(s) {
  let sc = 18 * (s.off[B] - s.off[P]);
  sc += 0.11 * (pip(s, P) - pip(s, B));
  sc += 7 * s.bar[P] - 12 * s.bar[B];
  for (let p = 1; p <= 24; p++) {
    const v = s.pts[p];
    if (v === -1) {
      // بلات ربات: بازیکن از خانه‌های بالاتر پایین می‌آید
      let hot = s.bar[P] > 0 && p >= 19;
      for (let j = p + 1; j <= Math.min(24, p + 6) && !hot; j++) if (s.pts[j] > 0) hot = true;
      sc -= hot ? 2.4 : 0.6;
    } else if (v <= -2) {
      sc += 0.7;
      if (p >= 19) sc += 1.2;        // خانهٔ ربات
      if (p <= 6) sc += 0.9;         // لنگر در خانهٔ حریف
      if (p >= 7 && p <= 18) sc += 0.3;
    }
  }
  // پرایم: خانه‌های پشت‌سرهم
  let run = 0;
  for (let p = 24; p >= 1; p--) {
    if (s.pts[p] <= -2) { run++; sc += 0.35 * run; } else run = 0;
  }
  return sc;
}

/** بهترین دنبالهٔ کامل برای ربات (هیوریستیک، بدون جست‌وجوی عمیق) */
export function botPlan(state, dice) {
  const memo = new Map();
  const target = maxDepth(state, B, dice, memo);
  if (!target) return [];
  let best = null, top = -Infinity, visited = 0;
  const walk = (st, rest, path) => {
    if (path.length === target) {
      visited++;
      const v = evaluate(st);
      if (v > top) { top = v; best = path; }
      return;
    }
    if (visited > 3000) return;
    const need = target - path.length;
    const tried = new Set();
    for (let i = 0; i < rest.length; i++) {
      const d = rest[i];
      if (tried.has(d)) continue;
      tried.add(d);
      const remain = rest.slice(0, i).concat(rest.slice(i + 1));
      for (const mv of genMoves(st, B, d)) {
        const ns = applyMove(st, B, mv);
        if (1 + maxDepth(ns, B, remain, memo) !== need) continue;
        walk(ns, remain, path.concat([mv]));
        if (visited > 3000) return;
      }
    }
  };
  walk(state, dice, []);
  return best || [];
}

export const rules = {
  P, B, initialState, cloneState, allHome, genMoves, applyMove, isHit,
  maxDepth, maxPlayable, pip, outcome, botPlan, evaluate,
};

/* ---------- هندسهٔ تخته (SVG) ---------- */
const PW = 46, BARW = 32, PLEN = 150, TOPY = 18, VH = 400, VBW = 670;
const BOTY = VH - TOPY;                 // ۳۸۲ — لبهٔ پایینی مثلث‌های پایین
const TRAYX = 610, TRAYW = 50;
const R = 18, GAPY = 36, MAXSTACK = 5;

const colX = (c) => 18 + c * PW + (c >= 6 ? BARW : 0);
function geom(p) {
  const top = p >= 13;
  const c = top ? p - 13 : 12 - p;
  return { x: colX(c), cx: colX(c) + PW / 2, top };
}
function slotY(p, k) {
  const g = geom(p);
  return g.top ? TOPY + R + k * GAPY : BOTY - R - k * GAPY;
}
const BARCX = colX(6) - BARW / 2;

export default {
  id: "backgammon",
  name: "تخته نرد",
  desc: "با ربات تخته بزن؛ مارس کنی، بیشتر می‌بری.",
  icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5">
    <rect x="5" y="8" width="38" height="32" rx="4"/>
    <path d="M24 8 v32" opacity=".6"/>
    <path d="M10 8 l4 11 l4 -11 M18 40 l4 -11 M30 8 l4 11 l4 -11" opacity=".6"/>
  </svg>`,

  render(root, ctx) {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeouts = new Set();
    let diceTimer = 0;
    const later = (fn, ms) => {
      const t = setTimeout(() => { timeouts.delete(t); fn(); }, ms);
      timeouts.add(t);
      return t;
    };
    const clearAll = () => {
      timeouts.forEach(clearTimeout);
      timeouts.clear();
      if (diceTimer) { clearInterval(diceTimer); diceTimer = 0; }
    };

    /* ---------- چیدمان صفحه ---------- */
    root.innerHTML = `
      <p class="muted" style="text-align:center;margin-top:0">
        مهره‌هایت فیروزه‌ای‌اند و به سمت خانهٔ پایین‌راست می‌روند. اول تاس بالاتر شروع می‌کند.
        <br>برد ساده ۲×، مارس ۳×، مارس ترکی ۴× شرط.
      </p>
      <div id="bg-boardwrap" style="margin:var(--sp-3) 0"></div>
      <div id="bg-status" class="mono" style="text-align:center;min-height:1.9em;color:var(--gold-ink);font-weight:700"></div>
      <div id="bg-dice" style="display:flex;gap:var(--sp-2);justify-content:center;align-items:center;flex-wrap:wrap;margin:var(--sp-2) 0;min-height:52px"></div>`;

    const bet = betControls(200);
    root.appendChild(bet.el);

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-top:var(--sp-2)";
    actions.innerHTML = `
      <button class="btn btn-gold btn-block" data-a="start" type="button">شروع بازی</button>
      <button class="btn" data-a="undo" type="button" hidden style="flex:1 1 140px">برگردان حرکت</button>
      <button class="btn btn-gold" data-a="end" type="button" hidden style="flex:1 1 140px">پایان نوبت</button>`;
    root.appendChild(actions);
    const startBtn = actions.querySelector('[data-a="start"]');
    const undoBtn = actions.querySelector('[data-a="undo"]');
    const endBtn = actions.querySelector('[data-a="end"]');

    const result = document.createElement("div");
    result.className = "result-line";
    root.appendChild(result);

    const boardWrap = root.querySelector("#bg-boardwrap");
    const statusEl = root.querySelector("#bg-status");
    const diceEl = root.querySelector("#bg-dice");

    /* ---------- وضعیت بازی ---------- */
    let state = initialState();
    let stake = 0;
    let phase = "idle";      // idle | opening | player | bot | over
    let dice = [];           // [{v, used, dead}]
    let history = [];        // برای برگردان در همین نوبت
    let legal = {};          // from → [{to, die}]
    let selected = null;     // شماره خانه یا 25 (بار)
    let lastMove = null;     // برای نمایش حرکت ربات

    const d6 = () => 1 + Math.floor(Math.random() * 6);

    /* ---------- رسم تخته ---------- */
    function checker(cx, cy, side, label) {
      const fill = side > 0 ? "var(--turq)" : "var(--gold)";
      const stroke = side > 0 ? "var(--turq-strong)" : "var(--gold-strong)";
      return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>` +
        (label
          ? `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="15" font-weight="700"
                fill="var(--surface)">${faNum(label)}</text>`
          : "");
    }

    function boardSVG() {
      const dests = selected != null ? (legal[selected] || []) : [];
      const destSet = new Set(dests.map((m) => m.to));
      let s = "";

      // قاب و زمین
      s += `<rect x="4" y="4" width="${VBW - 8}" height="${VH - 8}" rx="16"
              fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>`;
      s += `<rect x="${BARCX - BARW / 2}" y="10" width="${BARW}" height="${VH - 20}" rx="6"
              fill="var(--surface)" stroke="var(--line)"/>`;
      // سینی خروج
      s += `<rect x="${TRAYX}" y="10" width="${TRAYW}" height="${VH / 2 - 14}" rx="8"
              fill="var(--surface-2)" stroke="var(--line)"/>`;
      s += `<rect x="${TRAYX}" y="${VH / 2 + 4}" width="${TRAYW}" height="${VH / 2 - 14}" rx="8"
              fill="var(--surface-2)" stroke="${destSet.has(0) ? "var(--turq)" : "var(--line)"}"
              stroke-width="${destSet.has(0) ? 3 : 1}"
              ${destSet.has(0) ? 'stroke-dasharray="6 4"' : ""}/>`;

      // مثلث‌ها + شماره‌ها
      for (let p = 1; p <= 24; p++) {
        const g = geom(p);
        const fill = p % 2 ? "var(--surface-2)" : "var(--gold-soft)";
        const pts = g.top
          ? `${g.x},${TOPY} ${g.x + PW},${TOPY} ${g.cx},${TOPY + PLEN}`
          : `${g.x},${BOTY} ${g.x + PW},${BOTY} ${g.cx},${BOTY - PLEN}`;
        s += `<polygon points="${pts}" fill="${fill}" stroke="var(--line)" stroke-width="1"/>`;
        if (destSet.has(p))
          s += `<polygon points="${pts}" fill="var(--turq-soft)" stroke="var(--turq)"
                  stroke-width="2.5" stroke-dasharray="7 5"/>`;
        if (selected === p)
          s += `<polygon points="${pts}" fill="none" stroke="var(--gold)" stroke-width="3.5"/>`;
        const ty = g.top ? TOPY - 5 : BOTY + 13;
        s += `<text x="${g.cx}" y="${ty}" text-anchor="middle" font-size="11"
                fill="var(--ink-3)">${faNum(p)}</text>`;
      }

      // مهره‌ها
      for (let p = 1; p <= 24; p++) {
        const n = Math.abs(state.pts[p]);
        if (!n) continue;
        const side = state.pts[p] > 0 ? 1 : -1;
        const shown = Math.min(n, MAXSTACK);
        for (let k = 0; k < shown; k++) {
          const label = k === shown - 1 && n > MAXSTACK ? n : 0;
          s += checker(geom(p).cx, slotY(p, k), side, label);
        }
      }

      // نشانگر جای فرود مهره روی هر مقصد مجاز
      for (const to of destSet) {
        if (to < 1 || to > 24) continue;
        const own = state.pts[to] > 0 ? state.pts[to] : 0;   // بلات حریف زده می‌شود
        const k = Math.min(own, MAXSTACK - 1);
        s += `<circle cx="${geom(to).cx}" cy="${slotY(to, k)}" r="${R - 3}" fill="none"
                stroke="var(--turq)" stroke-width="3" stroke-dasharray="5 4"/>`;
      }

      // بار
      const pb = state.bar[P], bb = state.bar[B];
      for (let k = 0; k < Math.min(pb, 4); k++)
        s += checker(BARCX, 340 - k * 30, P, k === Math.min(pb, 4) - 1 && pb > 4 ? pb : 0);
      for (let k = 0; k < Math.min(bb, 4); k++)
        s += checker(BARCX, 60 + k * 30, B, k === Math.min(bb, 4) - 1 && bb > 4 ? bb : 0);
      if (selected === 25 && pb > 0)
        s += `<rect x="${BARCX - BARW / 2}" y="${VH / 2}" width="${BARW}" height="${VH / 2 - 10}" rx="6"
                fill="none" stroke="var(--gold)" stroke-width="3.5"/>`;

      // مهره‌های خارج‌شده
      for (let k = 0; k < state.off[B]; k++)
        s += `<rect x="${TRAYX + 7}" y="${16 + k * 11}" width="${TRAYW - 14}" height="8" rx="4"
                fill="var(--gold)" opacity=".92"/>`;
      for (let k = 0; k < state.off[P]; k++)
        s += `<rect x="${TRAYX + 7}" y="${VH - 24 - k * 11}" width="${TRAYW - 14}" height="8" rx="4"
                fill="var(--turq)" opacity=".92"/>`;
      s += `<text x="${TRAYX + 14}" y="${VH / 2 + 4}" text-anchor="middle" font-size="12"
              font-weight="700" fill="var(--gold-ink)">${faNum(state.off[B])}</text>`;
      s += `<text x="${TRAYX + 36}" y="${VH / 2 + 4}" text-anchor="middle" font-size="12"
              font-weight="700" fill="var(--turq)">${faNum(state.off[P])}</text>`;

      // آخرین حرکت ربات
      if (lastMove && lastMove.to >= 1 && lastMove.to <= 24) {
        const g = geom(lastMove.to);
        s += `<circle cx="${g.cx}" cy="${slotY(lastMove.to, 0)}" r="${R + 5}" fill="none"
                stroke="var(--gold)" stroke-width="2" opacity=".8"/>`;
      }

      // نواحی کلیک
      for (let p = 1; p <= 24; p++) {
        const g = geom(p);
        const y = g.top ? TOPY - 8 : BOTY - PLEN - 10;
        s += `<rect data-pt="${p}" x="${g.x}" y="${y}" width="${PW}" height="${PLEN + 18}"
                fill="transparent" style="cursor:pointer"/>`;
      }
      s += `<rect data-pt="bar" x="${BARCX - BARW / 2}" y="10" width="${BARW}" height="${VH - 20}"
              fill="transparent" style="cursor:pointer"/>`;
      s += `<rect data-pt="off" x="${TRAYX}" y="${VH / 2 + 4}" width="${TRAYW}" height="${VH / 2 - 14}"
              fill="transparent" style="cursor:pointer"/>`;

      return `<svg id="bg-board" viewBox="0 0 ${VBW} ${VH}" role="img"
                aria-label="تختهٔ نرد" style="width:100%;height:auto;display:block">${s}</svg>`;
    }

    function drawBoard() { boardWrap.innerHTML = boardSVG(); }

    /* ---------- تاس‌ها ---------- */
    const PIPS = {
      1: [[.5, .5]],
      2: [[.28, .28], [.72, .72]],
      3: [[.28, .28], [.5, .5], [.72, .72]],
      4: [[.28, .28], [.72, .28], [.28, .72], [.72, .72]],
      5: [[.28, .28], [.72, .28], [.5, .5], [.28, .72], [.72, .72]],
      6: [[.28, .25], [.72, .25], [.28, .5], [.72, .5], [.28, .75], [.72, .75]],
    };
    function dieSVG(v, opts = {}) {
      const size = 44, dim = opts.dim;
      const accent = opts.side === B ? "var(--gold)" : "var(--turq)";
      const pips = (PIPS[v] || [])
        .map(([x, y]) => `<circle cx="${x * size}" cy="${y * size}" r="3.6" fill="${accent}"/>`)
        .join("");
      return `<svg viewBox="0 0 ${size} ${size}" width="44" height="44" aria-hidden="true"
                style="opacity:${dim ? .35 : 1};transition:opacity var(--dur-base) var(--ease-out)">
          <rect x="1.5" y="1.5" width="${size - 3}" height="${size - 3}" rx="9"
            fill="var(--surface-2)" stroke="${dim ? "var(--line)" : "var(--line-strong)"}" stroke-width="2"/>
          ${pips}
        </svg>`;
    }
    function drawDice() {
      if (!dice.length) { diceEl.innerHTML = ""; return; }
      const side = phase === "bot" ? B : P;
      diceEl.innerHTML = dice
        .map((d) => `<span>${dieSVG(d.v, { dim: d.used || d.dead, side })}</span>`)
        .join("");
    }
    /** انیمیشن تاس، سپس فراخوانی done */
    function rollAnim(faces, done) {
      if (reduced) { done(); return; }
      let n = 0;
      const box = diceEl;
      clearInterval(diceTimer);
      diceTimer = setInterval(() => {
        n++;
        box.innerHTML = faces
          .map(() => `<span style="display:inline-block;transform:rotate(${(Math.random() * 24 - 12).toFixed(1)}deg)">${dieSVG(d6(), {})}</span>`)
          .join("");
        if (n >= 7) { clearInterval(diceTimer); diceTimer = 0; done(); }
      }, 70);
    }

    /* ---------- منطق نوبت ---------- */
    function activeDice() {
      return dice.filter((d) => !d.used && !d.dead).map((d) => d.v);
    }

    function computeLegal() {
      legal = {};
      if (phase !== "player") return;
      let dv = activeDice();
      if (!dv.length) return;
      const memo = new Map();
      let max = maxDepth(state, P, dv, memo);
      if (max === 0) return;

      // قاعدهٔ تاس بزرگ‌تر: اگر فقط یکی از دو تاس قابل بازی است، بزرگ‌تر مقدم است
      if (history.length === 0 && max === 1 && dv.length === 2 && dv[0] !== dv[1]) {
        const hi = Math.max(dv[0], dv[1]);
        const keep = genMoves(state, P, hi).length ? hi : Math.min(dv[0], dv[1]);
        for (const d of dice) if (d.v !== keep) d.dead = true;
        dv = [keep];
      }

      const tried = new Set();
      for (let i = 0; i < dv.length; i++) {
        const d = dv[i];
        if (tried.has(d)) continue;
        tried.add(d);
        const rest = dv.slice(0, i).concat(dv.slice(i + 1));
        for (const mv of genMoves(state, P, d)) {
          if (1 + maxDepth(applyMove(state, P, mv), P, rest, memo) !== max) continue;
          const arr = (legal[mv.from] ||= []);
          if (!arr.some((m) => m.to === mv.to && m.die === mv.die)) arr.push({ to: mv.to, die: mv.die });
        }
      }
    }

    function hasLegal() { return Object.keys(legal).length > 0; }

    function setStatus(t) { statusEl.textContent = t; }

    function refresh() {
      computeLegal();
      if (phase === "player") {
        if (selected != null && !legal[selected]) selected = null;
        const sources = Object.keys(legal);
        if (state.bar[P] > 0 && legal[25]) selected = 25;
        else if (selected == null && sources.length === 1) selected = +sources[0];
      }
      drawBoard();
      drawDice();
      updateControls();
    }

    function updateControls() {
      startBtn.hidden = !(phase === "idle" || phase === "over");
      undoBtn.hidden = phase !== "player";
      endBtn.hidden = phase !== "player";
      undoBtn.disabled = history.length === 0;
      endBtn.disabled = hasLegal();
      if (phase === "player") {
        if (!hasLegal()) {
          setStatus(activeDice().length
            ? "حرکتی ممکن نیست — «پایان نوبت» را بزن."
            : "تاس‌هایت تمام شد — «پایان نوبت» را بزن.");
        } else if (state.bar[P] > 0) {
          setStatus("مهرهٔ روی بار را وارد کن.");
        } else if (selected != null) {
          setStatus("خانهٔ مقصد روشن‌شده را بزن.");
        } else {
          setStatus("نوبت توست — یک مهره را انتخاب کن.");
        }
      }
    }

    /* ---------- شروع بازی و تاس اول ---------- */
    startBtn.addEventListener("click", () => {
      if (phase !== "idle" && phase !== "over") return;
      stake = bet.amount();
      if (!ctx.bet(stake)) return;
      state = initialState();
      history = []; selected = null; lastMove = null;
      result.className = "result-line";
      result.textContent = "";
      bet.setDisabled(true);
      phase = "opening";
      drawBoard();
      updateControls();
      openingRoll();
    });

    function openingRoll() {
      setStatus("تاس اول…");
      dice = [{ v: 1, used: false, dead: false }, { v: 1, used: false, dead: false }];
      rollAnim([1, 2], () => {
        const pd = d6(), bd = d6();
        dice = [{ v: pd, used: false, dead: false }, { v: bd, used: false, dead: false }];
        diceEl.innerHTML =
          `<span style="display:inline-flex;align-items:center;gap:6px">${dieSVG(pd, { side: P })}<b class="muted">تو</b></span>` +
          `<span style="display:inline-flex;align-items:center;gap:6px">${dieSVG(bd, { side: B })}<b class="muted">ربات</b></span>`;
        if (pd === bd) {
          setStatus("مساوی شد — دوباره!");
          later(openingRoll, 800);
          return;
        }
        const mine = pd > bd;
        setStatus(mine ? `تاس تو بالاتر بود — شروع با تو` : `تاس ربات بالاتر بود`);
        later(() => beginTurn(mine ? P : B, [pd, bd]), 900);
      });
    }

    function newDice(vals) {
      const v = vals || [d6(), d6()];
      return (v[0] === v[1] ? [v[0], v[0], v[0], v[0]] : v).map((x) => ({ v: x, used: false, dead: false }));
    }

    function beginTurn(side, vals) {
      history = [];
      selected = null;
      if (side === P) {
        phase = "player";
        lastMove = null;
        const go = () => {
          dice = newDice(vals);
          refresh();
        };
        if (vals) go();
        else {
          dice = newDice([1, 1]);
          setStatus("تاس می‌اندازی…");
          rollAnim([1, 2], go);
        }
      } else {
        phase = "bot";
        setStatus("نوبت ربات…");
        updateControls();
        const go = () => {
          dice = newDice(vals);
          drawDice();
          later(botTurn, 500);
        };
        if (vals) go();
        else { dice = newDice([1, 1]); rollAnim([1, 2], go); }
      }
    }

    /* ---------- نوبت ربات ---------- */
    function botTurn() {
      const plan = botPlan(state, activeDice());
      if (!plan.length) {
        setStatus("ربات حرکتی نداشت — نوبت به تو رسید.");
        later(() => beginTurn(P), 900);
        return;
      }
      let i = 0;
      const step = () => {
        if (i >= plan.length) {
          lastMove = null;
          if (checkWin()) return;
          later(() => beginTurn(P), 500);
          return;
        }
        const mv = plan[i++];
        const hit = isHit(state, B, mv);
        state = applyMove(state, B, mv);
        const d = dice.find((x) => !x.used && !x.dead && x.v === mv.die);
        if (d) d.used = true;
        lastMove = mv;
        drawBoard();
        drawDice();
        if (hit) ctx.toast("ربات مهره‌ات را زد!");
        if (state.off[B] === 15) { lastMove = null; checkWin(); return; }
        later(step, reduced ? 60 : 700);
      };
      step();
    }

    /* ---------- تعامل بازیکن ---------- */
    boardWrap.addEventListener("click", (e) => {
      if (phase !== "player") return;
      const t = e.target.closest("[data-pt]");
      if (!t) return;
      const raw = t.dataset.pt;
      const key = raw === "bar" ? 25 : raw === "off" ? 0 : +raw;

      // اگر مبدأ انتخاب شده و اینجا مقصد مجاز است، حرکت مقدم بر انتخاب دوباره است
      if (selected != null) {
        const cands = (legal[selected] || []).filter((m) => m.to === key);
        if (cands.length) {
          // خروج مهره: اگر تاسِ دقیق موجود است همان مصرف شود، وگرنه کوچک‌ترین تاسِ مجاز
          const exact = cands.find((m) => m.die === selected);
          const chosen = key === 0 && exact ? exact : cands.slice().sort((a, b) => a.die - b.die)[0];
          doMove({ from: selected, to: key, die: chosen.die });
          return;
        }
      }
      if (legal[key] && key !== 0) {
        if (selected === key && key !== 25) selected = null;
        else selected = key;
        drawBoard();
        updateControls();
      }
    });

    function doMove(mv) {
      history.push({ state: cloneState(state), dice: dice.map((d) => ({ ...d })), selected });
      const hit = isHit(state, P, mv);
      state = applyMove(state, P, mv);
      const d = dice.find((x) => !x.used && !x.dead && x.v === mv.die);
      if (d) d.used = true;
      selected = null;
      if (hit) ctx.toast("زدی! مهرهٔ ربات رفت روی بار.");
      if (state.off[P] === 15) { drawBoard(); drawDice(); checkWin(); return; }
      refresh();
    }

    undoBtn.addEventListener("click", () => {
      if (phase !== "player" || !history.length) return;
      const h = history.pop();
      state = h.state;
      dice = h.dice;
      selected = null;
      refresh();
    });

    endBtn.addEventListener("click", () => {
      if (phase !== "player" || hasLegal()) return;
      selected = null;
      beginTurn(B);
    });

    /* ---------- پایان بازی ---------- */
    function checkWin() {
      if (state.off[P] === 15) {
        const o = outcome(state, P);
        const win = Math.floor(stake * o.mult);
        ctx.credit(win);
        result.className = "result-line win";
        result.textContent = `${o.kind}! +${ctx.fmt(win)} سکه (${faNum(o.mult)}×)`;
        finish("بردی! 🎉");
        return true;
      }
      if (state.off[B] === 15) {
        const o = outcome(state, B);
        result.className = "result-line lose";
        result.textContent = o.mult === 2
          ? "ربات برد — این دست را باختی."
          : `ربات ${o.kind === "مارس ترکی" ? "مارس ترکی‌ات کرد" : "مارست کرد"} — این دست را باختی.`;
        finish("باختی.");
        return true;
      }
      return false;
    }

    function finish(msg) {
      phase = "over";
      dice = [];
      legal = {};
      selected = null;
      lastMove = null;
      clearAll();
      bet.setDisabled(false);
      startBtn.textContent = "دست بعدی";
      setStatus(msg);
      drawBoard();
      drawDice();
      updateControls();
    }

    /* ---------- شروع ---------- */
    drawBoard();
    updateControls();
    setStatus("شرطت را بگذار و بازی را شروع کن.");

    return () => { clearAll(); };
  },
};
