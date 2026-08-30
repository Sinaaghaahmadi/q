/**
 * Renders the three team scenes on the Asa site — a night desk, a standup
 * board, a model lab. Illustrated rather than photographed: nobody on this
 * team has agreed to be a stock photo, and a fake one would be a lie.
 *
 *   node asa/scripts/generate-team-images.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const W = 1600
const H = 1000

const font = await readFile(`${root}/app/fonts/Vazirmatn-Variable.woff2`)
const fontUrl = `data:font/woff2;base64,${font.toString('base64')}`

const GOLD = '#d4af5a'
const INK = '#eef2f6'

/** یک ایستگاه کاری: نمایشگر با کد، صفحه‌کلید، و هالهٔ نور. */
const desk = (x, y, s, lines, hue) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="150" rx="210" ry="26" fill="#000" opacity=".45"/>
    <rect x="-190" y="-130" width="380" height="230" rx="12" fill="#0b1119" stroke="#233242" stroke-width="3"/>
    <rect x="-176" y="-116" width="352" height="202" rx="6" fill="#070c12"/>
    ${lines
      .map(
        (w, i) =>
          `<rect x="${-164}" y="${-100 + i * 20}" width="${w}" height="7" rx="3.5"
             fill="${i % 4 === 0 ? GOLD : i % 3 === 0 ? '#7cb0ff' : '#33475b'}"
             opacity="${i % 4 === 0 ? 0.9 : 0.75}"/>`,
      )
      .join('')}
    <rect x="-30" y="100" width="60" height="26" fill="#16202a"/>
    <rect x="-96" y="126" width="192" height="12" rx="6" fill="#1d2833"/>
    <rect x="-150" y="146" width="300" height="16" rx="6" fill="#141d26" stroke="#243343" stroke-width="2"/>
    <circle cx="0" cy="-20" r="230" fill="hsl(${hue} 60% 55%)" opacity=".07"/>
  </g>`

/** یک آدم پشت میز: سر، شانه، و هدفون یا لیوان. */
const person = (x, y, s, hue, gear) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-92 120c6-56 42-80 92-80s86 24 92 80z" fill="hsl(${hue} 26% 18%)"/>
    <circle cx="0" cy="-14" r="52" fill="#c9b391"/>
    <path d="M-52 -18a52 52 0 0 1 104 0v-14a52 52 0 0 0-104 0z" fill="#151d26"/>
    ${gear === 'phones'
      ? `<g fill="none" stroke="${GOLD}" stroke-width="9" stroke-linecap="round">
           <path d="M-56 -10v-14a56 56 0 0 1 112 0v14"/><path d="M-56 -10v20"/><path d="M56 -10v20"/></g>`
      : gear === 'glass'
        ? `<g fill="none" stroke="#7cb0ff" stroke-width="5">
             <circle cx="-19" cy="-12" r="17"/><circle cx="19" cy="-12" r="17"/><path d="M-2 -12h4"/></g>`
        : `<g><rect x="70" y="52" width="34" height="40" rx="5" fill="#1d2833" stroke="${GOLD}" stroke-width="3"/>
             <path d="M104 62h12a10 10 0 0 1 0 20h-12" fill="none" stroke="${GOLD}" stroke-width="3"/>
             <path d="M78 44c0-8 8-8 8-16M92 44c0-8 8-8 8-16" stroke="#3d4d5e" stroke-width="3" fill="none"/></g>`}
  </g>`

const card = (x, y, w, h, tone, rows) => `
  <g transform="translate(${x} ${y})">
    <rect width="${w}" height="${h}" rx="10" fill="${tone}" stroke="#2a3846" stroke-width="2"/>
    ${rows
      .map((r, i) => `<rect x="14" y="${16 + i * 18}" width="${r}" height="7" rx="3.5"
        fill="${i === 0 ? GOLD : '#3a4c5f'}" opacity=".85"/>`)
      .join('')}
  </g>`

const scenes = [
  {
    file: 'team-01-shab-e-code',
    dept: 'بخش توسعه',
    title: 'شبِ کد',
    body: 'ساعتِ کارِ یک تیم توزیع‌شده تمام نمی‌شود: وقتی یکی می‌خوابد، دیگری کامیت می‌زند.',
    art: `
      ${desk(500, 430, 1, [230, 180, 260, 140, 205, 120, 250, 160, 190, 120], 200)}
      ${person(500, 620, 0.9, 210, 'phones')}
      ${desk(1080, 480, 0.78, [190, 240, 150, 210, 130, 245, 175, 120, 220, 150], 45)}
      ${person(1080, 650, 0.72, 30, 'mug')}
      <g opacity=".5">
        ${[...Array(26)].map((_, i) => `<circle cx="${90 + i * 58}" cy="${120 + (i % 5) * 34}" r="2"
          fill="${GOLD}" opacity="${0.2 + (i % 4) * 0.12}"/>`).join('')}
      </g>`,
  },
  {
    file: 'team-02-hamkari',
    shift: 'translate(-150 40) scale(.84)',
    dept: 'بخش محصول',
    title: 'ایستگاه روزانه',
    body: 'هر روز پانزده دقیقه: چه تمام شد، چه گیر کرده، و امروز چه کسی روی چه چیزی است.',
    art: `
      <g transform="translate(430 170)">
        <rect width="740" height="470" rx="16" fill="#0a1016" stroke="#243343" stroke-width="3"/>
        <text x="700" y="52" text-anchor="end" fill="${INK}" font-size="26" font-weight="800"
              font-family="Vazirmatn">تختهٔ فصل</text>
        ${['انجام‌شده', 'در جریان', 'در صف']
          .map(
            (t, c) => `
          <text x="${660 - c * 232}" y="104" text-anchor="end" fill="${GOLD}" font-size="17"
                font-family="Vazirmatn">${t}</text>
          ${[0, 1, 2, 3]
            .slice(0, 4 - c)
            .map((r) => card(452 - c * 232, 124 + r * 84, 190, 68, '#111a23', [120, 150, 90]))
            .join('')}`,
          )
          .join('')}
      </g>
      ${person(400, 620, 0.82, 190, 'glass')}
      ${person(1350, 580, 0.75, 340, 'phones')}`,
  },
  {
    file: 'team-03-azmayeshgah',
    shift: 'translate(-150 40) scale(.84)',
    dept: 'بخش هوش مصنوعی',
    title: 'آزمایشگاه مدل',
    body: 'مدل را روی دادهٔ واقعی می‌سنجیم، نه روی دمو. چیزی که نتیجه ندهد، منتشر نمی‌شود.',
    art: `
      <g transform="translate(420 190)">
        <rect width="760" height="430" rx="16" fill="#0a1016" stroke="#243343" stroke-width="3"/>
        <polyline points="${[...Array(40)]
          .map((_, i) => `${40 + i * 17},${330 - Math.min(250, 250 * (1 - Math.exp(-i / 9)) + Math.sin(i) * 8)}`)
          .join(' ')}"
          fill="none" stroke="${GOLD}" stroke-width="4" stroke-linecap="round"/>
        <polyline points="${[...Array(40)]
          .map((_, i) => `${40 + i * 17},${350 - Math.min(220, 220 * (1 - Math.exp(-i / 13)) + Math.cos(i) * 7)}`)
          .join(' ')}"
          fill="none" stroke="#7cb0ff" stroke-width="4" stroke-linecap="round" opacity=".8"/>
        <path d="M40 360 H720" stroke="#243343" stroke-width="3"/>
        <text x="700" y="60" text-anchor="end" fill="${INK}" font-size="24" font-weight="800"
              font-family="Vazirmatn">دقت مدل در هر دور آموزش</text>
        <text x="700" y="392" text-anchor="end" fill="#6c7d8d" font-size="15"
              font-family="Vazirmatn">۴۰ دور · دادهٔ واقعی</text>
      </g>
      <g transform="translate(210 470)">
        ${[0, 1, 2].map((i) => `<g transform="translate(0 ${i * 92})">
          <circle cx="0" cy="0" r="26" fill="none" stroke="${GOLD}" stroke-width="4"/>
          <circle cx="0" cy="0" r="9" fill="${GOLD}"/>
          <path d="M26 0h74" stroke="#33475b" stroke-width="4"/></g>`).join('')}
      </g>
      ${person(1370, 600, 0.72, 160, 'glass')}`,
  },
]

const page = ({ art, title, body, dept, shift }) => `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face{font-family:Vazirmatn;src:url("${fontUrl}") format("woff2");font-weight:100 900;font-display:block}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${W}px;height:${H}px}
  body{font-family:Vazirmatn,system-ui,sans-serif;direction:rtl;background:#06080b;
       color:${INK};overflow:hidden;position:relative}
  .glow{position:absolute;inset:0;background:
    radial-gradient(70% 60% at 50% 30%, rgba(212,175,90,.10), transparent 65%),
    radial-gradient(60% 60% at 15% 90%, rgba(124,176,255,.08), transparent 65%)}
  .grid{position:absolute;inset:0;opacity:.5;
    background-image:linear-gradient(#141d26 1px,transparent 1px),
                     linear-gradient(90deg,#141d26 1px,transparent 1px);
    background-size:80px 80px;
    -webkit-mask-image:radial-gradient(110% 80% at 50% 0%,#000,transparent 72%)}
  svg.art{position:absolute;inset:0;width:${W}px;height:${H}px}
  .tilewrap{position:absolute;inset:0;overflow:hidden;pointer-events:none}
  .tile{position:absolute;inset:-40%;transform:rotate(-24deg);display:flex;flex-wrap:wrap;
    gap:76px 104px;align-content:center;justify-content:center;opacity:.045;direction:ltr}
  .tile span{font-size:26px;font-weight:600;letter-spacing:.34em;color:#e9ddbe;white-space:nowrap}
  .copy{position:absolute;inset-block-start:74px;inset-inline-start:74px;max-width:440px}
  .kicker{font-size:14px;letter-spacing:.24em;color:${GOLD};font-weight:700;direction:ltr;text-align:left}
  h1{font-size:46px;line-height:1.35;font-weight:900;margin-top:16px;letter-spacing:-.02em}
  p{margin-top:16px;font-size:19px;line-height:2;color:#a8b6c4}
  .dept{margin-top:24px;display:inline-flex;align-items:center;gap:12px;border:1px solid #2a3846;
    border-radius:999px;padding:10px 20px;font-size:16px;font-weight:600;background:rgba(212,175,90,.07)}
  .dept i{width:7px;height:7px;border-radius:50%;background:${GOLD};display:block}
  .wm{position:absolute;right:60px;bottom:48px;display:flex;align-items:center;gap:16px}
  .wm .mk{width:44px;height:44px}
  .wm b{display:block;font-size:40px;font-weight:900;letter-spacing:.12em;direction:ltr;line-height:1}
  .wm span{display:block;margin-top:6px;font-size:14px;font-weight:600;opacity:.75}
</style>
<div class="glow"></div><div class="grid"></div>
<div class="tilewrap"><div class="tile">
  ${Array.from({ length: 44 }, () => `<span>Asa · ${dept}</span>`).join('')}
</div></div>
<svg class="art" viewBox="0 0 ${W} ${H}"><g transform="${shift || ''}">${art}</g></svg>
<div class="copy">
  <div class="kicker">ASA</div>
  <h1>${title}</h1>
  <p>${body}</p>
  <div class="dept"><i></i>${dept}</div>
</div>
<div class="wm">
  <svg class="mk" viewBox="0 0 120 120">
    <g fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M30 100 L30 62 Q30 33 60 18 Q90 33 90 62 L90 100"/><path d="M18 106 H102"/>
    </g>
    <path d="M60 19 L71.5 32 L60 45 L48.5 32 Z" fill="${GOLD}"/>
  </svg>
  <div><b>Asa</b><span>${dept}</span></div>
</div>`

await mkdir(`${root}/exports`, { recursive: true })
await mkdir(`${root}/app/img`, { recursive: true })

const browser = await chromium.launch()
const p = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })
for (const scene of scenes) {
  await p.setContent(page(scene), { waitUntil: 'load' })
  await p.evaluate(() => document.fonts.ready)
  await writeFile(`${root}/exports/${scene.file}.png`, await p.screenshot({ type: 'png' }))
  await writeFile(`${root}/app/img/${scene.file}.jpg`,
    await p.screenshot({ type: 'jpeg', quality: 86 }))
  console.log('rendered', scene.file)
}
await browser.close()
