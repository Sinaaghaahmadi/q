/**
 * Renders the project imagery for the Asa site.
 *
 * The two live products (delbarapp.online, qeymat.online) are not reachable
 * from CI, so each frame is a branded reconstruction of the product's real
 * surface rather than a raw screenshot. Every frame carries the Asa
 * watermark and the department that owned the work.
 *
 *   node asa/scripts/generate-project-images.mjs
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

const ink = '#0B0F14'
const gold = '#C7A667'

/* ── the shell every frame sits in ─────────────────────────────────────── */
const mark = (c, size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
  <path d="M5 19.5 12 4.5l7 15" stroke="${c}" stroke-width="2.6" stroke-linecap="round"
        stroke-linejoin="round"/>
  <path d="M7.6 14h9.6" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M8.8 10.6h6" stroke="${c}" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>
</svg>`

const shell = ({ tone, department, caption, body }) => `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face{font-family:Vazirmatn;src:url("${fontUrl}") format("woff2");font-weight:100 900;font-display:block}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${W}px;height:${H}px}
  body{font-family:Vazirmatn,system-ui,sans-serif;direction:rtl;
       background:${tone.canvas};color:${tone.ink};overflow:hidden;position:relative}
  .glow{position:absolute;inset:0;pointer-events:none;
    background:radial-gradient(120% 90% at 78% 6%, ${tone.glow} 0%, transparent 62%)}
  /* the tiled watermark — printed into the frame, not laid over it */
  .tilewrap{position:absolute;inset:0;overflow:hidden;pointer-events:none}
  .tile{position:absolute;inset:-40%;transform:rotate(-24deg);pointer-events:none;
    display:flex;flex-wrap:wrap;gap:74px 96px;align-content:center;justify-content:center;
    opacity:${tone.tileOpacity};direction:ltr}
  .tile span{font-size:26px;font-weight:600;letter-spacing:.34em;color:${tone.wm};
    white-space:nowrap}
  .stage{position:absolute;inset:0;display:grid;grid-template-columns:1fr 720px;
         align-items:center;gap:56px;padding:0 84px 40px}
  .lede{max-width:520px}
  .kicker{font-size:15px;letter-spacing:.22em;color:${tone.gold};font-weight:600;direction:ltr;
          text-align:right}
  h1{font-size:52px;line-height:1.35;font-weight:800;margin-top:18px;letter-spacing:-.01em}
  p{margin-top:18px;font-size:20px;line-height:2;color:${tone.dim};font-weight:400}
  .rule{width:64px;height:2px;background:${tone.gold};margin-top:30px;opacity:.85}
  .dept{margin-top:26px;display:inline-flex;align-items:center;gap:12px;
        border:1px solid ${tone.line};border-radius:999px;padding:11px 22px;
        font-size:17px;font-weight:600;color:${tone.ink};background:${tone.chip}}
  .dept i{width:7px;height:7px;border-radius:50%;background:${tone.gold};display:block}

  .device{width:720px;border-radius:26px;background:${tone.surface};
          border:1px solid ${tone.line};overflow:hidden;
          box-shadow:0 44px 100px rgba(0,0,0,.30), 0 8px 24px rgba(0,0,0,.14)}
  .bar{height:46px;display:flex;align-items:center;gap:8px;padding:0 18px;
       background:${tone.bar};border-bottom:1px solid ${tone.line}}
  .dot{width:10px;height:10px;border-radius:50%;background:${tone.line}}
  .url{margin-inline-start:auto;font-size:13px;color:${tone.dim};direction:ltr;letter-spacing:.04em}
  .screen{padding:24px 26px 28px}

  .wm{position:absolute;right:60px;bottom:46px;display:flex;align-items:center;gap:16px}
  .wm .txt{text-align:right}
  .wm b{display:block;font-size:46px;font-weight:800;letter-spacing:.14em;
        color:${tone.wm};line-height:1;direction:ltr}
  .wm span{display:block;margin-top:7px;font-size:15px;letter-spacing:.06em;
           color:${tone.wm};opacity:.8;font-weight:600}
  .cap{position:absolute;left:84px;bottom:52px;font-size:15px;color:${tone.dim};
       letter-spacing:.02em;max-width:520px}
</style>
<div class="glow"></div>
<div class="tilewrap"><div class="tile">${Array.from({ length: 44 }, () => `<span>Asa · ${department.fa}</span>`).join('')}</div></div>
<div class="stage">
  <div class="lede">
    <div class="kicker">ASA · ${department.en}</div>
    <h1>${caption.title}</h1>
    <p>${caption.body}</p>
    <div class="rule"></div>
    <div class="dept"><i></i>${department.fa}</div>
  </div>
  <div class="device">
    <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
      <span class="url">${caption.url}</span></div>
    <div class="screen">${body}</div>
  </div>
</div>
<div class="cap">${caption.foot}</div>
<div class="wm">${mark(tone.wm, 46)}<div class="txt"><b>Asa</b><span>${department.fa}</span></div></div>`

/* ── tones: each project reads differently on the page ─────────────────── */
const dark = {
  canvas: '#080B10', surface: '#0E141B', bar: '#0B1118', ink: '#F2F5F7',
  dim: '#98A3AE', line: '#1E2831', chip: 'rgba(199,166,103,.08)',
  gold, glow: 'rgba(199,166,103,.12)', wm: '#E9DDBE', tileOpacity: '.045',
}
const light = {
  canvas: '#FBFAF8', surface: '#FFFFFF', bar: '#F5F3EF', ink: '#12161C',
  dim: '#6E7681', line: '#E6E2DA', chip: 'rgba(199,166,103,.10)',
  gold: '#A2864F', glow: 'rgba(199,166,103,.18)', wm: '#12161C', tileOpacity: '.05',
}

/* ── little primitives the screens are drawn from ──────────────────────── */
const coin = () => `<svg width="40" height="40" viewBox="0 0 40 40" style="flex:none">
  <defs>
    <linearGradient id="cf" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F0DCA8"/><stop offset=".5" stop-color="#C7A667"/>
      <stop offset="1" stop-color="#8E7134"/></linearGradient>
  </defs>
  <ellipse cx="20" cy="33" rx="13" ry="3" fill="#000" opacity=".18"/>
  <path d="M5 18a15 9 0 0 0 30 0v4a15 9 0 0 1-30 0z" fill="#8E7134"/>
  <ellipse cx="20" cy="18" rx="15" ry="9" fill="url(#cf)"/>
  <ellipse cx="20" cy="18" rx="10.5" ry="6" fill="none" stroke="#fff" stroke-opacity=".45"/>
  <ellipse cx="15" cy="15" rx="4.5" ry="2.2" fill="#fff" opacity=".35"/>
</svg>`

const row = (t, name, sub, price, delta, up) => `
  <div style="display:flex;align-items:center;gap:14px;padding:15px 4px;
              border-bottom:1px solid ${t.line}">
    ${coin()}
    <div style="flex:1">
      <div style="font-size:17px;font-weight:600">${name}</div>
      <div style="font-size:13px;color:${t.dim};margin-top:3px">${sub}</div>
    </div>
    <div style="text-align:left;direction:${delta ? 'ltr' : 'rtl'}">
      <div style="font-size:18px;font-weight:700;font-variant-numeric:tabular-nums">${price}</div>
      ${delta ? `<div style="font-size:13px;margin-top:3px;font-variant-numeric:tabular-nums;
        color:${up ? '#2FA36B' : '#D2604F'}">${up ? '▲' : '▼'} ${delta}</div>` : ''}
    </div>
  </div>`

const spark = (t, seed, color) => {
  const pts = Array.from({ length: 26 }, (_, i) => {
    const v = Math.sin(i / 2.2 + seed) * 18 + Math.sin(i / 5 + seed * 2) * 12
    return `${(i / 25) * 620},${90 - v}`
  }).join(' ')
  return `<svg viewBox="0 0 620 160" style="width:100%;height:160px">
    <defs><linearGradient id="g${seed}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity=".28"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <polyline points="${pts} 620,160 0,160" fill="url(#g${seed})" stroke="none"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

const bubble = (t, text, me, time) => `
  <div style="display:flex;justify-content:${me ? 'flex-start' : 'flex-end'};margin:10px 0">
    <div style="max-width:74%;padding:13px 17px;font-size:16px;line-height:1.9;
      border-radius:${me ? '18px 18px 6px 18px' : '18px 18px 18px 6px'};
      background:${me ? 'linear-gradient(160deg,#7C4A63,#5E3550)' : t.chipBg};
      color:${me ? '#fff' : t.ink};border:1px solid ${me ? 'transparent' : t.line}">
      ${text}
      <div style="font-size:11px;margin-top:6px;opacity:.6;direction:ltr;text-align:left">${time}</div>
    </div>
  </div>`

const person = (t, name, sub, hue) => `
  <div style="display:flex;align-items:center;gap:14px;padding:14px 4px;
              border-bottom:1px solid ${t.line}">
    <div style="width:46px;height:46px;border-radius:50%;flex:none;
      background:conic-gradient(from 210deg, hsl(${hue} 55% 62%), hsl(${hue + 40} 50% 48%));
      box-shadow:0 6px 14px rgba(0,0,0,.18)"></div>
    <div style="flex:1">
      <div style="font-size:16px;font-weight:600">${name}</div>
      <div style="font-size:13px;color:${t.dim};margin-top:3px">${sub}</div>
    </div>
    <div style="width:9px;height:9px;border-radius:50%;background:#2FA36B"></div>
  </div>`

const stat = (t, label, value, foot) => `
  <div style="flex:1;border:1px solid ${t.line};border-radius:16px;padding:18px 16px;
              background:${t.chip}">
    <div style="font-size:13px;color:${t.dim}">${label}</div>
    <div style="font-size:28px;font-weight:800;margin-top:8px;direction:ltr;
                font-variant-numeric:tabular-nums">${value}</div>
    <div style="font-size:12px;color:${t.dim};margin-top:6px">${foot}</div>
  </div>`

const head = (t, title, right = '') => `
  <div style="display:flex;align-items:center;justify-content:space-between;
              padding-bottom:16px;border-bottom:1px solid ${t.line}">
    <div style="font-size:20px;font-weight:700">${title}</div>
    <div style="font-size:13px;color:${t.dim}">${right}</div></div>`

/* ── the six frames ────────────────────────────────────────────────────── */
const D = { ...light, chipBg: '#F4F1EC' }
const K = { ...dark, chipBg: '#141B23' }

const frames = [
  {
    file: 'qeymat-01-tablou-nerkh',
    tone: dark,
    department: { fa: 'بخش توسعه', en: 'ENGINEERING' },
    caption: {
      title: 'تابلوی نرخ لحظه‌ای',
      body: 'طلا، سکه، دلار، ارز و رمزارز — از ده‌ها منبع، در یک تابلوی واحد و بی‌درنگ.',
      url: 'qeymat.online', foot: 'قیمت آنلاین · نمای تابلوی نرخ · پیاده‌سازی Asa',
    },
    body: `${head(dark, 'نرخ لحظه‌ای بازار', 'به‌روزرسانی زنده')}
      ${row(dark, 'طلای ۱۸ عیار', 'هر گرم · تومان', '7,412,000', '0.8%', true)}
      ${row(dark, 'سکه امامی', 'تک‌فروشی · تومان', '84,900,000', '1.4%', true)}
      ${row(dark, 'دلار آمریکا', 'بازار آزاد · تومان', '92,350', '0.3%', false)}
      ${row(dark, 'یورو', 'بازار آزاد · تومان', '99,780', '0.6%', true)}
      ${row(dark, 'بیت‌کوین', 'تتر · جهانی', '104,230', '2.1%', true)}`,
  },
  {
    file: 'qeymat-02-tahlil-dade',
    tone: dark,
    department: { fa: 'بخش داده و تحلیل', en: 'DATA & ANALYTICS' },
    caption: {
      title: 'روند، نه فقط عدد',
      body: 'تاریخچه‌ی نرخ‌ها، مقایسه‌ی صرافی‌ها و نمودارهایی که تصمیم را ساده می‌کنند.',
      url: 'qeymat.online/chart', foot: 'قیمت آنلاین · نمای تحلیل روند · پیاده‌سازی Asa',
    },
    body: `${head(dark, 'روند طلای ۱۸ عیار', '۹۰ روز گذشته')}
      <div style="margin-top:8px">${spark(dark, 1.2, gold)}</div>
      <div style="display:flex;gap:12px;margin-top:16px">
        ${stat(dark, 'بیشترین', '7,588,000', 'مرداد ۱۴۰۵')}
        ${stat(dark, 'کمترین', '6,904,000', 'خرداد ۱۴۰۵')}
        ${stat(dark, 'میانگین', '7,201,400', '۹۰ روزه')}
      </div>`,
  },
  {
    file: 'qeymat-03-hoosh-masnooei',
    tone: dark,
    department: { fa: 'بخش هوش مصنوعی', en: 'ARTIFICIAL INTELLIGENCE' },
    caption: {
      title: 'هشدار هوشمند نرخ',
      body: 'مدل، نوسان غیرعادی را پیش از کاربر می‌بیند و فقط وقتی مهم است خبر می‌دهد.',
      url: 'qeymat.online/alerts', foot: 'قیمت آنلاین · موتور هشدار · پیاده‌سازی Asa',
    },
    body: `${head(dark, 'هشدارهای من', '۳ فعال')}
      <div style="border:1px solid ${gold}55;background:rgba(199,166,103,.08);
                  border-radius:16px;padding:18px;margin-top:16px">
        <div style="font-size:17px;font-weight:700;color:${gold}">نوسان غیرعادی سکه</div>
        <div style="font-size:15px;line-height:2;color:${dark.dim};margin-top:8px">
          در ۴۰ دقیقه‌ی گذشته ۱٫۹٪ رشد داشته — بیش از دو برابر نوسان معمول این ساعت.</div>
      </div>
      ${row(dark, 'دلار بالای ۹۳٬۰۰۰', 'هشدار سقف · فعال', 'روشن', '', true)}
      ${row(dark, 'طلا زیر ۷٬۲۰۰٬۰۰۰', 'هشدار کف · فعال', 'روشن', '', true)}`,
  },
  {
    file: 'delbar-01-goftogoo',
    tone: light,
    department: { fa: 'بخش توسعه', en: 'ENGINEERING' },
    caption: {
      title: 'گفت‌وگوی بی‌درنگ',
      body: 'پیام‌رسانی سریع با تحویل خوش‌بینانه؛ پیام پیش از شبکه روی صفحه می‌نشیند.',
      url: 'delbarapp.online', foot: 'دلبر · نمای گفت‌وگو · پیاده‌سازی Asa',
    },
    body: `${head(light, 'گفت‌وگو', 'آنلاین')}
      <div style="padding-top:8px">
        ${bubble(D, 'سلام! از همون شهر خودمونی؟', false, '21:04')}
        ${bubble(D, 'آره، همین نزدیکی. تازه اومدم.', true, '21:04')}
        ${bubble(D, 'خوش اومدی 🌿', false, '21:05')}
        ${bubble(D, 'ممنون — اینجا خیلی روون‌تر از بقیه‌ست.', true, '21:06')}
      </div>`,
  },
  {
    file: 'delbar-02-mahsool',
    tone: light,
    department: { fa: 'بخش محصول', en: 'PRODUCT' },
    caption: {
      title: 'کشفِ نزدیک‌ترین‌ها',
      body: 'یافتن هم‌شهری‌ها بر پایه‌ی موقعیت، با حریم خصوصی به‌عنوان پیش‌فرض.',
      url: 'delbarapp.online/discover', foot: 'دلبر · نمای کشف · پیاده‌سازی Asa',
    },
    body: `${head(light, 'نزدیک شما', 'شعاع ۵ کیلومتر')}
      ${person(light, 'کاربر ناشناس', 'همین شهر · ۲ دقیقه پیش', 320)}
      ${person(light, 'کاربر ناشناس', 'همین شهر · ۷ دقیقه پیش', 200)}
      ${person(light, 'کاربر ناشناس', 'شهر مجاور · ۱۲ دقیقه پیش', 260)}
      ${person(light, 'کاربر ناشناس', 'همین شهر · ۱۹ دقیقه پیش', 30)}`,
  },
  {
    file: 'delbar-03-pashtibani',
    tone: light,
    department: { fa: 'بخش پشتیبانی', en: 'SUPPORT' },
    caption: {
      title: 'پشتیبانی که پاسخ می‌دهد',
      body: 'تیکت، وضعیت شفاف و میانگین پاسخ زیر یک ساعت — بدون رفت‌وبرگشت اداری.',
      url: 'delbarapp.online/support', foot: 'دلبر · میز پشتیبانی · پیاده‌سازی Asa',
    },
    body: `${head(light, 'میز پشتیبانی', 'امروز')}
      <div style="display:flex;gap:12px;margin:16px 0">
        ${stat(light, 'در انتظار', '12', 'تیکت باز')}
        ${stat(light, 'میانگین پاسخ', '41m', 'زیر تعهد')}
        ${stat(light, 'رضایت', '97%', '۳۰ روز')}
      </div>
      ${row(light, 'مشکل ورود با شماره', 'تیکت #4182 · در حال بررسی', 'باز', '', true)}
      ${row(light, 'گزارش تخلف کاربر', 'تیکت #4179 · پاسخ داده شد', 'بسته', '', true)}`,
  },
]

/* ── render ────────────────────────────────────────────────────────────── */
await mkdir(`${root}/exports`, { recursive: true })
await mkdir(`${root}/app/img`, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })

for (const frame of frames) {
  const html = shell(frame)
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  const png = await page.screenshot({ type: 'png' })
  await writeFile(`${root}/exports/${frame.file}.png`, png)
  const jpg = await page.screenshot({ type: 'jpeg', quality: 88 })
  await writeFile(`${root}/app/img/${frame.file}.jpg`, jpg)
  console.log('rendered', frame.file)
}

await browser.close()
