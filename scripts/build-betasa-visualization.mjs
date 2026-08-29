#!/usr/bin/env node
/**
 * ساخت صفحهٔ «نمایش محصول» بتاسا.
 *
 * ورودی‌ها:
 *   betasa/app/css/betasa.css        — توکن‌ها (هر دو تم)
 *   betasa/app/js/games/*.js         — آیکون/نام/توضیح هر بازی
 *   betasa/app/icons/icon.svg        — لوگومارک
 *   <shots dir>/*.jpg                   — ۴۰ فریم واقعی
 *
 * خروجی:
 *   betasa/app/visualization.html    — تک‌فایل، تصاویر به‌صورت data: URI
 *
 * اجرا:  node scripts/build-betasa-visualization.mjs [shotsDir]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BETASA = path.join(ROOT, "betasa", "app");
const OUT = path.join(BETASA, "visualization.html");
const SHOTS =
  process.argv[2] ||
  "/tmp/claude-0/-home-user-q/9891749e-9d67-5238-8efe-c75ff0346bb9/scratchpad/shots";

const die = (msg) => {
  console.error("✗ build-betasa-visualization: " + msg);
  process.exit(1);
};

const read = (p) => {
  if (!fs.existsSync(p)) die("فایل ورودی پیدا نشد: " + p);
  return fs.readFileSync(p, "utf8");
};

/* ---------------------------------------------------------------- توکن‌ها */

/** بلوکِ بعد از یک سلکتور را برمی‌گرداند (این فایل تودرتو ندارد). */
function block(css, selector, from = 0) {
  const i = css.indexOf(selector, from);
  if (i < 0) die("سلکتور «" + selector + "» در betasa.css نبود");
  const open = css.indexOf("{", i);
  const close = css.indexOf("}", open);
  if (open < 0 || close < 0) die("بلوک «" + selector + "» ناقص است");
  return { body: css.slice(open + 1, close), end: close };
}

function decls(rawBody) {
  const body = rawBody.replace(/\/\*[\s\S]*?\*\//g, " ");
  const out = new Map();
  for (const line of body.split(";")) {
    const m = line.match(/^\s*(--[a-z0-9-]+)\s*:\s*([\s\S]+?)\s*$/i);
    if (m) out.set(m[1], m[2]);
  }
  return out;
}

const css = read(path.join(BETASA, "css", "betasa.css"));
const lightBlock = block(css, ":root{");
const light = decls(lightBlock.body);
const scale = decls(block(css, ":root{", lightBlock.end).body); // بلوک دوم: توکن‌های غیررنگی
const dark = decls(block(css, ':root[data-theme="dark"]').body);

if (light.size < 20 || dark.size < 20 || scale.size < 20)
  die("پارس توکن‌ها ناقص بود (light=" + light.size + " dark=" + dark.size + " scale=" + scale.size + ")");

/** نام‌های فارسی توکن‌های رنگ — همان واژگان دیزاین‌سیستم محصول. */
const COLOR_LABEL = {
  "--bg": "زمینهٔ صفحه",
  "--bg-2": "زمینهٔ دوم",
  "--surface": "سطح کارت",
  "--surface-2": "سطح فرورفته",
  "--ink": "متن اصلی",
  "--ink-2": "متن ثانویه",
  "--ink-3": "متن کم‌رنگ",
  "--gold": "طلایی تزئینی",
  "--gold-ink": "طلایی متن‌خوان",
  "--gold-strong": "طلایی پررنگ",
  "--gold-soft": "طلایی محو",
  "--turq": "فیروزه‌ای",
  "--turq-strong": "فیروزه‌ای پررنگ",
  "--turq-soft": "فیروزه‌ای محو",
  "--line": "خط جداکننده",
  "--line-strong": "خط پررنگ",
  "--danger": "باخت/خطا",
  "--win": "برد",
  "--chip-bg": "زمینهٔ چیپ",
  "--cta-ink": "متن روی طلایی",
  "--girih": "گره تزئینی",
};
const COLOR_ORDER = Object.keys(COLOR_LABEL);
for (const k of COLOR_ORDER)
  if (!light.has(k) || !dark.has(k)) die("توکن رنگ «" + k + "» در یکی از دو تم نبود");

/* ------------------------------------------------------------ آیکون بازی‌ها */

const GAMES_DIR = path.join(BETASA, "js", "games");
const registry = read(path.join(GAMES_DIR, "index.js"));
const orderMatch = registry.match(/export const games = \[([^\]]+)\]/);
if (!orderMatch) die("ترتیب بازی‌ها در games/index.js خوانده نشد");
const order = orderMatch[1].split(",").map((s) => s.trim()).filter(Boolean);

const games = order.map((id) => {
  const src = read(path.join(GAMES_DIR, id + ".js"));
  const name = src.match(/name:\s*"([^"]+)"/);
  const desc = src.match(/desc:\s*"([^"]+)"/);
  const icon = src.match(/icon:\s*`([\s\S]*?)`,\n/);
  if (!name || !desc || !icon) die("name/desc/icon در ماژول «" + id + "» پیدا نشد");
  return { id, name: name[1], desc: desc[1], icon: icon[1].trim() };
});
if (games.length !== 10) die("انتظار ۱۰ بازی بود، " + games.length + " پیدا شد");

/* ------------------------------------------------------------- لوگومارک */

const markSvg = read(path.join(BETASA, "icons", "icon.svg"));
const markInner = markSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim();
if (!markInner.includes("<circle")) die("محتوای icon.svg غیرمنتظره بود");

/* ------------------------------------------------------------------ کامیت */

let commit = "unknown";
try {
  commit = execFileSync("git", ["-C", ROOT, "rev-parse", "--short", "HEAD"], {
    encoding: "utf8",
  }).trim();
} catch {
  /* بدون گیت هم باید ساخته شود */
}

/* ------------------------------------------------------------------ فریم‌ها */

const D = { w: 2160, h: 1350 }; // ۱۴۴۰×۹۰۰ در مقیاس ۱٫۵
const M = { w: 1170, h: 1992 }; // آیفون ۱۳ — ۳۹۰×۶۶۴ در مقیاس ۳

const acts = [
  {
    id: "act-lobby",
    title: "پردهٔ یک — لابی و مسیرهای اصلی",
    lede: "سه صفحه‌ای که کاربر بدون بازی‌کردن هم می‌بیند.",
    shots: [
      {
        file: "desk-l-lobby.jpg",
        full: true,
        path: "betasa.app/#/",
        title: "لابی، تم روشن",
        note: "سلام بالای صفحه از ساعت محلی می‌آید؛ گرید با auto-fill پر می‌شود و برای همین ردیف دوم فقط چهار کارت دارد.",
      },
      {
        file: "desk-l-leaderboard.jpg",
        path: "betasa.app/#/leaderboard",
        title: "جدول امتیازات",
        note: "پنج برد برتر از حافظهٔ همین مرورگر خوانده می‌شود؛ ستون تاریخ هنوز میلادیِ لاتین است و به فارسی برنگشته.",
      },
      {
        file: "desk-l-rewards.jpg",
        path: "betasa.app/#/rewards",
        title: "ماموریت‌های روزانه",
        note: "ماموریت تمام‌شده دکمه‌اش به «دریافت شد» خاموش می‌شود؛ دو ماموریت دیگر جایزهٔ آمادهٔ دریافت دارند.",
      },
    ],
  },
  {
    id: "act-games",
    title: "پردهٔ دو — ده بازی، یک قالب",
    lede: "همهٔ بازی‌ها یک قاب مشترک دارند: عنوان، تخته، کنترل شرط، یک دکمهٔ اصلی.",
    shots: [
      {
        file: "desk-l-crash.jpg",
        full: true,
        path: "betasa.app/#/game/crash",
        title: "کرش، پیش از شروع",
        note: "ضریب روی ۱٫۰۰ ایستاده و نمودار خالی است؛ قاب بازی سقف ۷۲۰ پیکسل دارد و در ۱۴۴۰ وسط می‌ماند.",
      },
      {
        file: "desk-l-mines.jpg",
        path: "betasa.app/#/game/mines",
        title: "ماین‌ها با دو جواهر باز",
        note: "بالای شبکه، ضریب فعلی و مبلغ برداشت کنار هم به‌روز می‌شوند تا تصمیمِ «حالا برداریم؟» یک‌جا دیده شود.",
      },
      {
        file: "desk-l-plinko.jpg",
        path: "betasa.app/#/game/plinko",
        title: "پلینکو، هرم ۱۲ ردیفی",
        note: "سیزده خانهٔ ضریب زیر هرم؛ فقط خانه‌های سودده طلایی قاب گرفته‌اند و خانه‌های زیر یک خنثی مانده‌اند.",
      },
      {
        file: "desk-l-dice.jpg",
        path: "betasa.app/#/game/dice",
        title: "تاس — تنها جایی که پالت می‌شکند",
        note: "اسلایدر هدف با رنگ پیش‌فرض مرورگر رندر می‌شود؛ روی این ورودی accent-color ست نشده و آبی از پالت بیرون می‌زند.",
      },
      {
        file: "desk-l-wheel.jpg",
        path: "betasa.app/#/game/wheel",
        title: "گردونه، دوازده قطاع",
        note: "هفت قطاع از دوازده‌تا صفرند؛ رنگ هر قطاع از ضریبش می‌آید نه از جایش، پس نقشهٔ رنگ خودش شانس را لو می‌دهد.",
      },
      {
        file: "desk-l-tower.jpg",
        path: "betasa.app/#/game/tower",
        title: "برج، هشت طبقهٔ خاموش",
        note: "طبقات پیش از شرط‌بندی هم کشیده می‌شوند تا با زدن «شروع صعود» ارتفاع صفحه نپرد.",
      },
      {
        file: "desk-l-keno.jpg",
        path: "betasa.app/#/game/keno",
        title: "کِنو، چهل خانهٔ عدد",
        note: "ارقام فارسی‌اند و ترتیبشان راست‌به‌چپ می‌رود؛ تا عددی انتخاب نشود خط راهنما با طلایی متن‌خوان هشدار می‌دهد.",
      },
    ],
  },
  {
    id: "act-ds",
    title: "پردهٔ سه — دیزاین‌سیستم زنده",
    lede: "صفحهٔ جدا در design-system.html — نه اسکرین‌شات، بلکه همان توکن‌ها در حال اجرا.",
    shots: [
      {
        file: "desk-l-ds-color.jpg",
        full: true,
        path: "betasa.app/design-system.html#color",
        title: "پالت با نام و مقدار",
        note: "هر سواچ نام توکن و مقدار واقعی‌اش را نشان می‌دهد؛ این مقادیر در زمان اجرا از فایل CSS خوانده می‌شوند نه از فهرستی دستی.",
      },
      {
        file: "desk-l-ds-contrast.jpg",
        path: "betasa.app/design-system.html#contrast",
        title: "چرا دو طلایی داریم",
        note: "پایین پالت، جدایی --gold تزئینی از --gold-ink متن‌خوان توضیح داده می‌شود — نتیجهٔ مستقیم جدول بعدی.",
      },
      {
        file: "desk-l-ds-type.jpg",
        path: "betasa.app/design-system.html#contrast",
        title: "جدول کنتراست، تم روشن",
        note: "یازده ترکیب سنجیده شده و تنها یک ردیف مرزی است: طلایی تزئینی روی کارت با ۳٫۸۶ فقط برای متن درشت قبول می‌شود.",
      },
      {
        file: "desk-l-ds-components.jpg",
        path: "betasa.app/design-system.html#radius",
        title: "گردی، عمق، حرکت",
        note: "پنج پلهٔ گردی از چیپ تا قاب، سه ماده سطح، و سه صحنهٔ حرکت که عدد و منحنی‌شان زیر هرکدام نوشته شده.",
      },
      {
        file: "desk-l-ds-a11y.jpg",
        path: "betasa.app/design-system.html#components",
        title: "کامپوننت با همهٔ حالت‌ها",
        note: "دکمه‌ها با حالت غیرفعال و فوکوس در کنار حالت عادی آمده‌اند؛ حالت‌ها اینجا مستند شده‌اند نه فرض.",
      },
    ],
  },
  {
    id: "act-dark",
    title: "پردهٔ چهار — همان محصول در تاریکی",
    lede: "این فریم‌ها با prefers-color-scheme واقعیِ dark گرفته شده‌اند، نه با فیلتر روی نسخهٔ روشن.",
    shots: [
      {
        file: "desk-d-lobby.jpg",
        full: true,
        path: "betasa.app/#/",
        title: "لابی، تم تاریک",
        note: "سرمه‌ای جای کرم را می‌گیرد و طلایی روشن‌تر می‌شود؛ نوار قوس ایوان بالای کارت‌ها اینجا واضح‌تر از تم روشن دیده می‌شود.",
      },
      {
        file: "desk-d-crash.jpg",
        path: "betasa.app/#/game/crash",
        title: "کرش در تاریکی",
        note: "دکمهٔ طلایی همان گرادیان را دارد ولی متن رویش به --cta-ink سرمه‌ای می‌رود تا روی طلایی روشن خوانا بماند.",
      },
      {
        file: "desk-d-mines.jpg",
        path: "betasa.app/#/game/mines",
        title: "ماین‌ها، سطح فرورفته",
        note: "خانه‌های بسته از --surface-2 رنگ می‌گیرند؛ در تاریکی این سطح روشن‌تر از زمینه است، برعکس تم روشن.",
      },
      {
        file: "desk-d-plinko.jpg",
        path: "betasa.app/#/game/plinko",
        title: "پلینکو، میخ‌ها روی سرمه‌ای",
        note: "میخ‌ها با --ink-3 کشیده می‌شوند؛ همین یک توکن تفاوت دیده‌شدن هرم روی کرم و روی سرمه‌ای را جبران می‌کند.",
      },
      {
        file: "desk-d-dice.jpg",
        path: "betasa.app/#/game/dice",
        title: "همان اسلایدر، همان عیب",
        note: "آبی پیش‌فرض مرورگر در تم تاریک بیشتر توی چشم می‌زند — عیبی که با یک خط accent-color حل می‌شود و هنوز نشده.",
      },
      {
        file: "desk-d-wheel.jpg",
        path: "betasa.app/#/game/wheel",
        title: "گردونه‌ای که خودش تم‌پذیر است",
        note: "قطاع‌ها رنگشان را از متغیرهای CSS می‌گیرند، پس چرخ بدون یک خط کد اضافه در تاریکی روشن‌تر می‌شود.",
      },
      {
        file: "desk-d-tower.jpg",
        path: "betasa.app/#/game/tower",
        title: "برج، مرزها با طلایی محو",
        note: "قاب طبقات با --line مرزبندی شده که در تم تاریک طلاییِ کم‌شفاف است نه خاکستری.",
      },
      {
        file: "desk-d-keno.jpg",
        path: "betasa.app/#/game/keno",
        title: "کِنو، اندازه‌ها ثابت",
        note: "بین دو تم فقط رنگ عوض می‌شود؛ اندازهٔ خانه‌ها، فاصله‌ها و گردی‌ها یکسان مانده‌اند چون توکن‌های غیررنگی مشترک‌اند.",
      },
      {
        file: "desk-d-leaderboard.jpg",
        path: "betasa.app/#/leaderboard",
        title: "جدول امتیازات در تاریکی",
        note: "سبز برد به نسخهٔ روشن‌ترش جابه‌جا می‌شود؛ تاریخ لاتین اما همان‌طور لاتین مانده است.",
      },
      {
        file: "desk-d-rewards.jpg",
        path: "betasa.app/#/rewards",
        title: "ماموریت‌ها در تاریکی",
        note: "دکمهٔ دریافت‌شده فقط با کاهش کدری غیرفعال می‌شود — بدون رنگ خاکستری جدا، تا پالت کوچک بماند.",
      },
      {
        file: "desk-d-ds-color.jpg",
        path: "betasa.app/design-system.html#color",
        title: "همان بیست‌ویک توکن، مقدار دیگر",
        note: "ستون‌ها عوض شده‌اند نه فیلتر شده: مثلاً --cta-ink از کرمِ روشن به قهوه‌ای تیره می‌رود تا روی طلایی بنشیند.",
      },
      {
        file: "desk-d-ds-contrast.jpg",
        path: "betasa.app/design-system.html#contrast",
        title: "سطح تیره زیر پالت",
        note: "سطح کارت در تاریکی سرمه‌ای است و همان سواچ‌ها روی آن دوباره سنجیده می‌شوند.",
      },
      {
        file: "desk-d-ds-type.jpg",
        path: "betasa.app/design-system.html#contrast",
        title: "جدول کنتراست، تم تاریک",
        note: "اینجا هیچ ردیفی مرزی نیست؛ حتی طلایی تزئینی روی کارت به ۷٫۸۳ می‌رسد، چون تم تاریک فضای بیشتری برای روشنی دارد.",
      },
      {
        file: "desk-d-ds-components.jpg",
        path: "betasa.app/design-system.html#radius",
        title: "عمق بدون انباشتن سایه",
        note: "سه ماده سطح در تاریکی با اختلاف روشنی از هم جدا می‌شوند؛ سایه یک لایه بیشتر ندارد.",
      },
      {
        file: "desk-d-ds-a11y.jpg",
        path: "betasa.app/design-system.html#components",
        title: "حالت‌ها در تاریکی",
        note: "همان کامپوننت‌ها با همان حالت‌ها — حلقهٔ فوکوس در هر دو تم طلایی است و از --focus-ring می‌آید.",
      },
    ],
  },
  {
    id: "act-mobile",
    title: "پردهٔ پنج — روی گوشی",
    lede: "پروفایل آیفون ۱۳؛ همان کد، بدون قالب موبایلِ جداگانه.",
    phone: true,
    shots: [
      {
        file: "mob-l-lobby.jpg",
        title: "لابی روی ۳۹۰ پیکسل",
        note: "همان گرید auto-fill حالا دو ستونه می‌شود؛ نوار نصب پایین صفحه چسبیده می‌ماند و روی کارت‌ها می‌افتد.",
      },
      {
        file: "mob-d-lobby.jpg",
        title: "لابی موبایل، تاریک",
        note: "هدر شیشه‌ای با blur در عرض کم هم می‌ماند؛ چیپ سکه و دکمهٔ تم کنار هم جا می‌شوند.",
      },
      {
        file: "mob-l-coinflip.jpg",
        title: "شیر یا خط",
        note: "دو دکمهٔ اصلی تمام‌عرض کنار هم‌اند — طلایی و فیروزه‌ای، تا انتخاب فقط با رنگ هم قابل تشخیص نباشد.",
      },
      {
        file: "mob-d-coinflip.jpg",
        title: "همان صفحه در تاریکی",
        note: "سکه یک ایموجی است نه تصویر؛ همان چیزی که با rotateX می‌چرخد و در هیچ تمی رنگ عوض نمی‌کند.",
      },
      {
        file: "mob-l-hilo.jpg",
        title: "بالا/پایین",
        note: "چهار دکمه در دو ردیف: دو حدس، یک برداشت، یک ادامه — «ادامه» عمداً بی‌قاب مانده تا کنش اصلی نباشد.",
      },
      {
        file: "mob-d-hilo.jpg",
        title: "بالا/پایین در تاریکی",
        note: "کارت وسط از --surface-2 است؛ خال پیک با متن اصلی کشیده می‌شود پس در هر دو تم درست می‌نشیند.",
      },
      {
        file: "mob-l-rewards.jpg",
        title: "ماموریت‌ها روی گوشی",
        note: "عنوان و دکمه در عرض کم زیر هم می‌روند؛ ردیف ماموریت به‌جای شکستن، ارتفاع می‌گیرد.",
      },
      {
        file: "mob-d-rewards.jpg",
        title: "ماموریت‌های تاریک",
        note: "همان سه ردیف؛ فاصله‌ها از مقیاس ۴ پیکسلی می‌آیند و بین موبایل و دسکتاپ فرقی نمی‌کنند.",
      },
      {
        file: "mob-l-ds.jpg",
        title: "جدول کنتراست روی گوشی",
        note: "جدول در ظرف اسکرول افقی خودش می‌ماند تا بدنهٔ صفحه هرگز افقی اسکرول نشود.",
      },
      {
        file: "mob-d-ds.jpg",
        title: "دیزاین‌سیستم، موبایل تاریک",
        note: "همان صفحهٔ مستندات روی گوشی خوانده می‌شود — دیزاین‌سیستم اینجا یک سند جدا نیست، بخشی از خود اپ است.",
      },
    ],
  },
];

/* ----------------------------------------------------- خواندن و درون‌ریزی */

const expected = acts.flatMap((a) => a.shots.map((s) => s.file));
if (expected.length !== 40) die("انتظار ۴۰ فریم بود، فهرست " + expected.length + " تاست");

if (!fs.existsSync(SHOTS)) die("پوشهٔ اسکرین‌شات‌ها پیدا نشد: " + SHOTS);
const onDisk = fs.readdirSync(SHOTS).filter((f) => f.endsWith(".jpg")).sort();
const missing = expected.filter((f) => !onDisk.includes(f));
if (missing.length) die("این فریم‌ها در پوشه نبودند:\n  " + missing.join("\n  "));
const extra = onDisk.filter((f) => !expected.includes(f));
if (extra.length) die("این فریم‌ها در پوشه هستند ولی در صفحه استفاده نشده‌اند:\n  " + extra.join("\n  "));

const dataUri = new Map();
for (const f of expected) {
  const buf = fs.readFileSync(path.join(SHOTS, f));
  if (buf.length < 1024) die("فریم «" + f + "» مشکوکاً کوچک است (" + buf.length + " بایت)");
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) die("فریم «" + f + "» JPEG نیست");
  dataUri.set(f, "data:image/jpeg;base64," + buf.toString("base64"));
}

/* ---------------------------------------------------------------- کمکی‌ها */

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ltr = (s) => '<span class="ltr mono">' + esc(s) + "</span>";
const fa = (n) => String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);

/* ------------------------------------------------------------ بخش توکن‌ها */

const swatches = COLOR_ORDER.map((k) => {
  const isSoft = /soft|line|girih/.test(k);
  return (
    '<div class="sw">' +
    '<div class="sw-chip' + (isSoft ? " sw-chip-alpha" : "") + '" style="background:var(' + k + ')"></div>' +
    '<div class="sw-meta">' +
    '<b>' + esc(COLOR_LABEL[k]) + "</b>" +
    '<code class="ltr mono">' + esc(k) + "</code>" +
    '<span class="sw-vals">' +
    '<span class="ltr mono" title="روشن">' + esc(light.get(k)) + "</span>" +
    '<span class="ltr mono" title="تاریک">' + esc(dark.get(k)) + "</span>" +
    "</span></div></div>"
  );
}).join("");

const spaceRow = ["--sp-1", "--sp-2", "--sp-3", "--sp-4", "--sp-5", "--sp-6", "--sp-8", "--sp-10", "--sp-12"]
  .map(
    (k) =>
      '<div class="sp"><div class="sp-bar" style="width:var(' + k + ');height:var(' + k + ')"></div>' +
      '<code class="ltr mono">' + esc(k) + "</code>" +
      '<span class="ltr mono dim">' + esc(scale.get(k) || "") + "</span></div>"
  )
  .join("");

const radiusRow = ["--r-sm", "--r-md", "--r-lg", "--r-xl", "--r-pill"]
  .map(
    (k) =>
      '<div class="rad" style="border-radius:var(' + k + ')">' +
      '<code class="ltr mono">' + esc(k) + "</code>" +
      '<span class="ltr mono dim">' + esc(scale.get(k) || "") + "</span></div>"
  )
  .join("");

const TYPE_ROWS = [
  ["--fs-h1", "تیتر صفحه", "بتاسا — بازی رایگان با سکه"],
  ["--fs-h2", "تیتر بخش", "دیزاین‌سیستم لوکس ایرانی"],
  ["--fs-h3", "تیتر کوچک", "ماموریت‌های امروز"],
  ["--fs-lg", "متن درشت", "ضریب بالا می‌رود؛ به‌موقع برداشت کن."],
  ["--fs-body", "متن بدنه", "ده بازی سریع با سکهٔ مجازی — بدون پول واقعی."],
  ["--fs-sm", "متن کوچک", "جایزهٔ ورود روزانه هر ۲۴ ساعت تازه می‌شود."],
  ["--fs-caption", "زیرنویس", "توضیح کوتاه زیر کارت بازی."],
];
const typeRows = TYPE_ROWS.map(
  ([k, label, sample]) =>
    '<div class="ty"><div class="ty-meta"><code class="ltr mono">' +
    esc(k) +
    '</code><span class="ltr mono dim">' +
    esc(scale.get(k) || "") +
    "</span><span class=\"dim\">" +
    esc(label) +
    '</span></div><p class="ty-sample" style="font-size:var(' +
    k +
    ')">' +
    esc(sample) +
    "</p></div>"
).join("");

const motionTokens = ["--dur-fast", "--dur-base", "--dur-slow", "--ease-out", "--ease-spring"]
  .map(
    (k) =>
      '<li><code class="ltr mono">' + esc(k) + '</code> <span class="ltr mono dim">' + esc(scale.get(k) || "") + "</span></li>"
  )
  .join("");

/* ---------------------------------------------------------------- آیکون‌ها */

const iconTiles = games
  .map(
    (g) =>
      '<div class="tile"><span class="tile-icon">' +
      g.icon +
      '</span><b>' +
      esc(g.name) +
      "</b><span class=\"tile-id ltr mono\">" +
      esc(g.id) +
      "</span></div>"
  )
  .join("");

/* ----------------------------------------------------------------- فریم‌ها */

function shotFigure(s, phone) {
  const dim = phone ? M : D;
  const img =
    '<img src="' +
    dataUri.get(s.file) +
    '" width="' +
    dim.w +
    '" height="' +
    dim.h +
    '" decoding="async" alt="' +
    esc(s.title) +
    '">';
  const body = phone
    ? '<div class="phone"><span class="phone-bar"></span>' + img + "</div>"
    : '<div class="win"><div class="win-bar"><span class="dots"><i></i><i></i><i></i></span>' +
      '<span class="win-url ltr mono">' +
      esc(s.path) +
      "</span></div>" +
      img +
      "</div>";
  return (
    '<figure class="shot' +
    (s.full ? " shot-full" : "") +
    '">' +
    body +
    "<figcaption><b>" +
    esc(s.title) +
    "</b><p>" +
    esc(s.note) +
    '</p><span class="file ltr mono">' +
    esc(s.file) +
    "</span></figcaption></figure>"
  );
}

const actsHtml = acts
  .map(
    (a) =>
      '<section class="act" id="' +
      a.id +
      '"><h3>' +
      esc(a.title) +
      '</h3><p class="lede">' +
      esc(a.lede) +
      '</p><div class="shots">' +
      a.shots.map((s) => shotFigure(s, a.phone)).join("") +
      "</div></section>"
  )
  .join("");

/* -------------------------------------------------------------- قالب صفحه */

const heroGame = games[0]; // کرش — اولین کارت لابی

const html = `<title>بتاسا — نمایش محصول</title>
<meta name="color-scheme" content="light dark">
<meta name="description" content="روایت تصویری محصول بتاسا: توکن‌ها، آیکون‌ها، حرکت و ۴۰ فریم واقعی از اپ در حال اجرا.">
<style>
@font-face{
  font-family:"Vazirmatn";
  src:url("fonts/Vazirmatn-Variable.woff2") format("woff2-variations");
  font-weight:100 900;
  font-display:swap;
}

/* ---------- توکن‌های رنگ: عیناً از betasa/app/css/betasa.css ---------- */
:root{
  color-scheme: light dark;
${COLOR_ORDER.map((k) => "  " + k + ":" + light.get(k) + ";").join("\n")}
  --hero-grad:${light.get("--hero-grad")};
  --shadow:${light.get("--shadow")};
  --gold-grad:${light.get("--gold-grad")};
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
${COLOR_ORDER.map((k) => "    " + k + ":" + dark.get(k) + ";").join("\n")}
    --hero-grad:${dark.get("--hero-grad")};
    --shadow:${dark.get("--shadow")};
    --gold-grad:${dark.get("--gold-grad")};
  }
}
:root[data-theme="dark"]{
${COLOR_ORDER.map((k) => "  " + k + ":" + dark.get(k) + ";").join("\n")}
  --hero-grad:${dark.get("--hero-grad")};
  --shadow:${dark.get("--shadow")};
  --gold-grad:${dark.get("--gold-grad")};
}

/* ---------- توکن‌های غیررنگی: مشترک بین دو تم ---------- */
:root{
${[...scale.entries()].map(([k, v]) => "  " + k + ":" + v + ";").join("\n")}
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;
  --measure:64ch;
}

*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;
  background:var(--bg);
  color:var(--ink);
  font-family:"Vazirmatn",system-ui,sans-serif;
  line-height:var(--lh-body);
  overflow-x:hidden;
}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
.ltr,code{direction:ltr;unicode-bidi:isolate}
code{font-family:var(--mono);font-size:.82em}
.dim{color:var(--ink-3)}
h1,h2,h3,h4{text-wrap:balance;line-height:var(--lh-tight);margin:0}
p{margin:0}
img{display:block;max-width:100%;height:auto}
:where(a,button):focus-visible{outline:var(--focus-ring);outline-offset:var(--focus-offset)}

.wrap{width:100%;max-width:1120px;margin-inline:auto;padding-inline:var(--sp-4)}
.sec{padding-block:var(--sp-12);border-top:1px solid var(--line)}
.sec:first-of-type{border-top:0}
.sec-head{margin-bottom:var(--sp-6)}
.sec-num{
  display:inline-block;font-family:var(--mono);font-size:var(--fs-caption);
  color:var(--gold-ink);letter-spacing:.08em;margin-bottom:var(--sp-2);
}
.sec-head h2{font-size:var(--fs-h2);font-weight:var(--fw-black)}
.sec-head p{color:var(--ink-2);max-width:var(--measure);margin-top:var(--sp-2)}
.note{color:var(--ink-2);max-width:var(--measure);font-size:var(--fs-sm)}

/* ---------- نوار بالا ---------- */
.top{
  position:sticky;top:0;z-index:30;
  display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);
  padding:10px var(--sp-4);
  background:color-mix(in srgb, var(--surface) 88%, transparent);
  backdrop-filter:blur(10px);
  border-bottom:1px solid var(--line);
}
.top-brand{display:inline-flex;align-items:center;gap:10px;font-weight:var(--fw-black)}
.top-brand svg{width:26px;height:26px;flex:none}
.theme-btn{
  border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);
  border-radius:var(--r-pill);padding:6px 14px;cursor:pointer;font:inherit;
  font-size:var(--fs-sm);font-weight:var(--fw-bold);
  transition:border-color var(--dur-base) var(--ease-out);
}
.theme-btn:hover{border-color:var(--gold)}

/* ---------- ۱. هیرو ---------- */
.hero{
  display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--sp-10);
  align-items:center;
  padding-block:var(--sp-12) var(--sp-10);
}
.hero h1{font-size:clamp(1.7rem,5vw,2.6rem);font-weight:var(--fw-black)}
.hero .sub{color:var(--ink-2);max-width:var(--measure);margin-top:var(--sp-4)}
.hero .meta{
  margin-top:var(--sp-6);display:flex;flex-wrap:wrap;gap:var(--sp-2);
  font-size:var(--fs-caption);
}
.hero .meta span{
  border:1px solid var(--line);border-radius:var(--r-pill);
  background:var(--chip-bg);padding:4px 12px;
  font-family:var(--mono);color:var(--ink-2);
}
.hero .meta span b{color:var(--ink);font-weight:var(--fw-bold)}

/* کارت بازی — بازسازی‌شده با CSS، نه اسکرین‌شات */
.hero-stage{
  position:relative;padding:var(--sp-8);border-radius:var(--r-xl);
  background:var(--hero-grad);border:1px solid var(--line);box-shadow:var(--shadow);
}
.hero-stage::after{
  content:"بازسازی‌شده با CSS";
  position:absolute;inset-inline-start:var(--sp-3);bottom:var(--sp-2);
  font-family:var(--mono);font-size:.68rem;color:var(--ink-3);
}
.game-card{
  position:relative;width:190px;
  display:flex;flex-direction:column;align-items:center;gap:var(--sp-2);
  border:1px solid var(--line);
  border-radius:var(--r-lg) var(--r-lg) var(--r-md) var(--r-md);
  background:var(--surface);box-shadow:var(--shadow);
  padding:22px 12px 14px;text-align:center;
}
.game-card::before{
  content:"";position:absolute;top:0;left:12px;right:12px;height:5px;
  border-radius:0 0 12px 12px;background:var(--gold-grad);opacity:.85;
}
.game-card .g-icon{color:var(--turq);width:52px;height:52px}
.game-card .g-icon svg{width:100%;height:100%}
.game-card .g-name{font-weight:var(--fw-black)}
.game-card .g-desc{font-size:var(--fs-caption);color:var(--ink-2);line-height:1.6}

/* ---------- ۲. توکن‌ها ---------- */
.sw-grid{display:grid;gap:var(--sp-3);grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}
.sw{
  border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden;
  background:var(--surface);
}
.sw-chip{height:56px;border-bottom:1px solid var(--line)}
.sw-chip-alpha{
  background-image:linear-gradient(45deg,var(--surface-2) 25%,transparent 25%,transparent 75%,var(--surface-2) 75%),
                   linear-gradient(45deg,var(--surface-2) 25%,transparent 25%,transparent 75%,var(--surface-2) 75%);
  background-size:14px 14px;background-position:0 0,7px 7px;
}
.sw-meta{padding:var(--sp-2) var(--sp-3) var(--sp-3);display:grid;gap:2px}
.sw-meta b{font-size:var(--fs-sm)}
.sw-meta code{color:var(--gold-ink)}
.sw-vals{display:flex;gap:var(--sp-2);flex-wrap:wrap;font-size:.7rem;color:var(--ink-3)}

.mats{display:grid;gap:var(--sp-3);grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-top:var(--sp-6)}
.mat{border:1px solid var(--line);border-radius:var(--r-lg);padding:var(--sp-5);min-height:110px;display:grid;align-content:end;gap:2px}
.mat b{font-size:var(--fs-sm)}
.mat-surface{background:var(--surface);box-shadow:var(--shadow)}
.mat-surface2{background:var(--surface-2)}
.mat-hero{background:var(--hero-grad)}
.mat-gold{background:var(--gold-grad);color:var(--cta-ink);border-color:transparent}
.mat-gold code{color:inherit;opacity:.85}

.scale-row{display:flex;flex-wrap:wrap;gap:var(--sp-4);align-items:flex-end;margin-top:var(--sp-4)}
.sp{display:grid;gap:4px;justify-items:center;font-size:.7rem}
.sp-bar{background:var(--gold);border-radius:2px;min-width:4px;min-height:4px}
.rad{
  border:2px solid var(--gold);background:var(--gold-soft);
  padding:var(--sp-4) var(--sp-5);display:grid;gap:2px;justify-items:center;font-size:.7rem;
}
.ty{display:grid;gap:4px;padding-block:var(--sp-3);border-bottom:1px solid var(--line)}
.ty:last-child{border-bottom:0}
.ty-meta{display:flex;gap:var(--sp-3);flex-wrap:wrap;font-size:.72rem;align-items:baseline}
.ty-meta code{color:var(--gold-ink)}
.ty-sample{line-height:var(--lh-tight);font-weight:var(--fw-medium)}
.motion-list{margin:var(--sp-4) 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:var(--sp-2)}
.motion-list li{
  border:1px solid var(--line);border-radius:var(--r-pill);
  padding:4px 12px;font-size:.72rem;background:var(--surface)
}
.motion-list code{color:var(--gold-ink)}
.sub-h{margin-top:var(--sp-8);font-size:var(--fs-h3);font-weight:var(--fw-black)}

/* ---------- ۳. آیکون‌ها ---------- */
.tiles{display:grid;gap:var(--sp-3);grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.tile{
  position:relative;display:flex;flex-direction:column;align-items:center;gap:var(--sp-2);
  border:1px solid var(--line);
  border-radius:var(--r-lg) var(--r-lg) var(--r-md) var(--r-md);
  background:var(--surface);box-shadow:var(--shadow);padding:22px 12px 14px;
  transition:transform var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out);
}
.tile::before{
  content:"";position:absolute;top:0;left:12px;right:12px;height:5px;
  border-radius:0 0 12px 12px;background:var(--gold-grad);opacity:.85;
}
.tile-icon{color:var(--turq);width:48px;height:48px;display:block}
.tile-icon svg{width:100%;height:100%}
.tile b{font-size:var(--fs-sm)}
.tile-id{font-size:.68rem;color:var(--ink-3)}
@media (hover:hover) and (pointer:fine){
  .tile:hover{transform:translateY(-3px);border-color:var(--gold)}
  .tile:hover .tile-icon{color:var(--turq-strong)}
}

/* ---------- ۴. لوگومارک ---------- */
.marks{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--sp-4)}
.mark-plate{
  border:1px solid var(--line);border-radius:var(--r-lg);padding:var(--sp-6);
  display:flex;align-items:flex-end;gap:var(--sp-5);flex-wrap:wrap;
}
.mark-light{background:#f6f1e7;color:#20261f}
.mark-dark{background:#0b1520;color:#eee6d2}
.mark-plate figure{margin:0;display:grid;gap:6px;justify-items:center}
.mark-plate figcaption{font-family:var(--mono);font-size:.66rem;opacity:.6}
.mark-plate svg{display:block}

/* ---------- ۵. حرکت ---------- */
.scenes{display:grid;gap:var(--sp-4);grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.scene{
  border:1px solid var(--line);border-radius:var(--r-lg);background:var(--surface);
  box-shadow:var(--shadow);padding:var(--sp-5);display:grid;gap:var(--sp-3);
}
.scene-stage{
  min-height:150px;border-radius:var(--r-md);background:var(--surface-2);
  display:grid;place-items:center;padding:var(--sp-4);overflow:hidden;
}
.scene h4{font-size:var(--fs-sm);font-weight:var(--fw-black)}
.scene p{font-size:var(--fs-caption);color:var(--ink-2);line-height:1.7}
.scene .hint{font-size:.68rem;color:var(--ink-3);font-family:var(--mono)}

.lift-card{
  width:150px;position:relative;text-align:center;padding:20px 12px 12px;
  border:1px solid var(--line);
  border-radius:var(--r-lg) var(--r-lg) var(--r-md) var(--r-md);
  background:var(--surface);box-shadow:var(--shadow);
  transition:transform var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out);
}
.lift-card::before{
  content:"";position:absolute;top:0;left:12px;right:12px;height:5px;
  border-radius:0 0 12px 12px;background:var(--gold-grad);opacity:.85;
}
.lift-card .g-icon{color:var(--turq);width:40px;height:40px;margin-inline:auto}
.lift-card .g-icon svg{width:100%;height:100%}
.lift-card b{display:block;margin-top:6px;font-size:var(--fs-sm)}
@media (hover:hover) and (pointer:fine){
  .lift-card:hover{transform:translateY(-3px);border-color:var(--gold)}
}

.coin{
  font-size:3.4rem;line-height:1.1;display:inline-block;
  transform:rotateX(0deg);
}
.coin.spin{transition:transform 950ms cubic-bezier(.3,.7,.4,1);transform:rotateX(1080deg)}

.count{
  font-family:var(--mono);font-size:2rem;font-weight:var(--fw-black);
  color:var(--gold-ink);font-variant-numeric:tabular-nums;
}
.crash-svg{width:100%;max-width:220px;height:auto}
.crash-line{
  stroke:var(--turq);stroke-width:3;fill:none;stroke-linecap:round;
  stroke-dasharray:var(--len,300);stroke-dashoffset:var(--len,300);
}
.crash-line.run{animation:draw 2600ms linear infinite}
@keyframes draw{
  0%{stroke-dashoffset:var(--len,300)}
  78%{stroke-dashoffset:0}
  86%{stroke-dashoffset:0;stroke:var(--turq)}
  87%,100%{stroke-dashoffset:0;stroke:var(--danger)}
}
.crash-mult{font-family:var(--mono);font-weight:var(--fw-black);color:var(--ink);font-size:var(--fs-lg)}

.xfade{position:relative;width:150px;height:112px}
.xfade .lift-card{position:absolute;inset:0;width:auto;transition:none}
.xfade .b{animation:fadeb 5200ms var(--ease-out) infinite}
@keyframes fadeb{0%,42%{opacity:0}50%,92%{opacity:1}100%{opacity:0}}
.tok-light{--surface:#fffdf8;--line:rgba(60,52,20,.16);--turq:#0e7d78;--ink:#20261f;
  --gold-grad:linear-gradient(135deg,#8f6d18,#856418 60%,#77590f);color:#20261f}
.tok-dark{--surface:#122130;--line:rgba(212,175,87,.18);--turq:#3fc1b6;--ink:#eee6d2;
  --gold-grad:linear-gradient(135deg,#e8c878,#d4af57 60%,#b98f34);color:#eee6d2}

.mini-btn{
  border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);
  border-radius:var(--r-sm);padding:5px 14px;cursor:pointer;font:inherit;
  font-size:var(--fs-caption);font-weight:var(--fw-bold);
}

/* ---------- ۶. فریم‌ها ---------- */
.act{margin-top:var(--sp-12)}
.act:first-of-type{margin-top:var(--sp-6)}
.act h3{font-size:var(--fs-h3);font-weight:var(--fw-black)}
.act .lede{color:var(--ink-2);max-width:var(--measure);margin-top:6px;font-size:var(--fs-sm)}
.shots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sp-6);margin-top:var(--sp-6)}
.shot{margin:0;min-width:0}
.shot-full{grid-column:1 / -1}
.shot figcaption{margin-top:var(--sp-3)}
.shot figcaption b{display:block;font-size:var(--fs-sm);font-weight:var(--fw-black)}
.shot figcaption p{color:var(--ink-2);font-size:var(--fs-caption);line-height:1.75;max-width:var(--measure);margin-top:2px}
.shot .file{display:inline-block;margin-top:6px;font-size:.66rem;color:var(--ink-3)}

.win{
  border:1px solid var(--line-strong);border-radius:var(--r-md);overflow:hidden;
  background:var(--surface-2);box-shadow:var(--shadow);
}
.win-bar{
  display:flex;align-items:center;gap:var(--sp-3);
  padding:7px var(--sp-3);border-bottom:1px solid var(--line);
  background:var(--surface);direction:ltr;
}
.dots{display:inline-flex;gap:5px;flex:none}
.dots i{width:9px;height:9px;border-radius:50%;background:var(--line-strong)}
.dots i:first-child{background:color-mix(in srgb,var(--danger) 70%,transparent)}
.dots i:nth-child(2){background:color-mix(in srgb,var(--gold) 70%,transparent)}
.dots i:last-child{background:color-mix(in srgb,var(--win) 70%,transparent)}
.win-url{
  flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-pill);
  padding:2px 12px;font-size:.68rem;color:var(--ink-2);
}
.win img{width:100%}

.phone{
  position:relative;max-width:300px;margin-inline:auto;
  border:1px solid var(--line-strong);border-radius:34px;overflow:hidden;
  background:var(--surface);box-shadow:var(--shadow);padding:9px;
}
.phone img{width:100%;border-radius:26px}
.phone-bar{
  position:absolute;top:15px;left:50%;transform:translateX(-50%);
  width:74px;height:5px;border-radius:99px;background:var(--line-strong);z-index:2;
}

/* ---------- ۷. روش ---------- */
.method{display:grid;gap:var(--sp-3);grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.method div{border:1px solid var(--line);border-radius:var(--r-md);background:var(--surface);padding:var(--sp-4);font-size:var(--fs-sm)}
.method dt{font-weight:var(--fw-black);font-size:var(--fs-caption);color:var(--ink-2);margin-bottom:4px}
.method dd{margin:0}
.cmd{
  margin-top:var(--sp-5);border:1px solid var(--line);border-radius:var(--r-md);
  background:var(--surface-2);padding:var(--sp-4);overflow-x:auto;
}
.cmd pre{margin:0;font-family:var(--mono);font-size:.74rem;direction:ltr;unicode-bidi:isolate;color:var(--ink-2)}

/* ---------- پاورقی ---------- */
.foot{
  border-top:1px solid var(--line);background:var(--bg-2);
  padding-block:var(--sp-8);margin-top:var(--sp-12);
}
.foot p{color:var(--ink-2);font-size:var(--fs-sm);max-width:var(--measure)}
.foot .sig{margin-top:var(--sp-3);font-family:var(--mono);font-size:.72rem;color:var(--ink-3)}

@media (max-width:860px){
  .hero{grid-template-columns:1fr;gap:var(--sp-6)}
  .shots{grid-template-columns:1fr}
}
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{
    animation-duration:.01ms !important;animation-iteration-count:1 !important;
    transition-duration:.01ms !important;
  }
  html{scroll-behavior:auto}
}
</style>

<header class="top">
  <span class="top-brand">
    <svg viewBox="0 0 512 512" aria-hidden="true">${markInner}</svg>
    بتاسا — نمایش محصول
  </span>
  <button id="theme-toggle" class="theme-btn" type="button">تم روشن / تاریک</button>
</header>

<main>
  <!-- ۱. هیرو -->
  <section class="wrap hero">
    <div>
      <h1>بتاسا، از نزدیک</h1>
      <p class="sub">
        این صفحه محصول را روایت می‌کند: توکن‌هایش، آیکون‌هایش، حرکتش، و ۴۰ فریم
        واقعی از اپ در حال اجرا. کارتِ کنار همین متن عکس نیست — با CSS و SVG
        و با همان توکن‌های محصول دوباره ساخته شده است.
      </p>
      <div class="meta">
        <span><b>${fa(40)}</b> فریم</span>
        <span><b>${fa(2)}</b> تم</span>
        <span>PWA ${ltr("v1")}</span>
        <span>کانسپت «لوکس ایرانی»</span>
        <span>کامیت ${ltr(commit)}</span>
      </div>
    </div>
    <div class="hero-stage">
      <div class="game-card">
        <span class="g-icon">${heroGame.icon}</span>
        <span class="g-name">${esc(heroGame.name)}</span>
        <span class="g-desc">${esc(heroGame.desc)}</span>
      </div>
    </div>
  </section>

  <!-- ۲. دیزاین‌سیستم -->
  <section class="wrap sec" id="tokens">
    <div class="sec-head">
      <div class="sec-num">۰۱ — TOKENS</div>
      <h2>دیزاین‌سیستم، زنده</h2>
      <p>
        رنگ‌های زیر همان مقادیر ${ltr("betasa/app/css/betasa.css")} هستند و در زمان
        ساخت این صفحه از خود فایل خوانده شده‌اند. هر سواچ مقدار تم روشن و بعد تم
        تاریک را نشان می‌دهد؛ خودِ نمونه با تم فعلی مرورگر شما رنگ می‌گیرد.
      </p>
    </div>
    <div class="sw-grid">${swatches}</div>

    <h3 class="sub-h">سطح و عمق</h3>
    <p class="note">چهار ماده‌ای که کل رابط از آن‌ها ساخته شده. سایه فقط یک لایه دارد.</p>
    <div class="mats">
      <div class="mat mat-surface"><b>سطح کارت</b><code class="ltr mono">--surface + --shadow</code></div>
      <div class="mat mat-surface2"><b>سطح فرورفته</b><code class="ltr mono">--surface-2</code></div>
      <div class="mat mat-hero"><b>زمینهٔ هیرو</b><code class="ltr mono">--hero-grad</code></div>
      <div class="mat mat-gold"><b>کنش اصلی</b><code class="ltr mono">--gold-grad</code></div>
    </div>

    <h3 class="sub-h">فاصله — پایهٔ ۴ پیکسل</h3>
    <div class="scale-row">${spaceRow}</div>

    <h3 class="sub-h">گردی گوشه</h3>
    <div class="scale-row">${radiusRow}</div>

    <h3 class="sub-h">مقیاس تایپ — نسبت ۱٫۲۵ روی ریشهٔ ۱۶ پیکسل</h3>
    <div>${typeRows}</div>

    <h3 class="sub-h">حرکت — سه سرعت، دو منحنی</h3>
    <ul class="motion-list">${motionTokens}</ul>
  </section>

  <!-- ۳. آیکون‌ها -->
  <section class="wrap sec" id="icons">
    <div class="sec-head">
      <div class="sec-num">۰۲ — ICONS</div>
      <h2>ده آیکون، ده ماژول</h2>
      <p>
        هر آیکون داخل همان ماژول بازی زندگی می‌کند و اینجا عیناً از
        ${ltr("betasa/app/js/games/*.js")} برداشته شده — نه بازکشیده. همه
        ${ltr("stroke")} با ضخامت ۲٫۵ روی کادر ۴۸ و رنگ ارثی از
        ${ltr("currentColor")}. روی نشانگر دقیق، کاشی‌ها همان ۳ پیکسل بالا می‌آیند
        که در محصول می‌آیند.
      </p>
    </div>
    <div class="tiles">${iconTiles}</div>
  </section>

  <!-- ۴. لوگومارک -->
  <section class="wrap sec" id="mark">
    <div class="sec-head">
      <div class="sec-num">۰۳ — MARK</div>
      <h2>لوگومارک</h2>
      <p>
        دو شش‌ضلعی هم‌مرکز به سبک گره‌چینی — بیرونی طلایی، درونی فیروزه‌ای —
        با یک سکهٔ توپر در مرکز: بازی و سکه، در یک نشان.
      </p>
    </div>
    <div class="marks">
      <div class="mark-plate mark-light">
        <figure><svg viewBox="0 0 512 512" width="112" height="112">${markInner}</svg><figcaption>112</figcaption></figure>
        <figure><svg viewBox="0 0 512 512" width="64" height="64">${markInner}</svg><figcaption>64</figcaption></figure>
        <figure><svg viewBox="0 0 512 512" width="32" height="32">${markInner}</svg><figcaption>32</figcaption></figure>
        <figure><svg viewBox="0 0 512 512" width="16" height="16">${markInner}</svg><figcaption>16</figcaption></figure>
      </div>
      <div class="mark-plate mark-dark">
        <figure><svg viewBox="0 0 512 512" width="112" height="112">${markInner}</svg><figcaption>112</figcaption></figure>
        <figure><svg viewBox="0 0 512 512" width="64" height="64">${markInner}</svg><figcaption>64</figcaption></figure>
        <figure><svg viewBox="0 0 512 512" width="32" height="32">${markInner}</svg><figcaption>32</figcaption></figure>
        <figure><svg viewBox="0 0 512 512" width="16" height="16">${markInner}</svg><figcaption>16</figcaption></figure>
      </div>
    </div>
    <p class="note" style="margin-top:var(--sp-4)">
      نشان زمینهٔ سرمه‌ای خودش را همراه دارد، پس روی هر دو صفحه یکسان دیده می‌شود؛
      در ۱۶ پیکسل شش‌ضلعی درونی تقریباً حل می‌شود و فقط سکه و قاب می‌ماند.
    </p>
  </section>

  <!-- ۵. حرکت -->
  <section class="wrap sec" id="motion">
    <div class="sec-head">
      <div class="sec-num">۰۴ — MOTION</div>
      <h2>حرکت، زنده — نه گیف</h2>
      <p>
        پنج صحنهٔ زیر همان انیمیشن‌های محصول‌اند که با CSS و کمی جاوااسکریپت
        دوباره اجرا می‌شوند. همه زیر ${ltr("prefers-reduced-motion: reduce")} خاموش
        می‌شوند و صحنه‌های تعاملی فقط روی نشانگر دقیق فعال‌اند.
      </p>
    </div>
    <div class="scenes">

      <div class="scene">
        <div class="scene-stage">
          <div class="lift-card" id="lift-card">
            <span class="g-icon">${games[1].icon}</span>
            <b>${esc(games[1].name)}</b>
          </div>
        </div>
        <h4>بالا آمدن کارت</h4>
        <p>کارت زیر نشانگر ۳ پیکسل بالا می‌آید و مرزش طلایی می‌شود.</p>
        <span class="hint">translateY(-3px) · 200ms · ease-out</span>
      </div>

      <div class="scene">
        <div class="scene-stage"><span class="coin" id="coin">🪙</span></div>
        <h4>چرخش سکه</h4>
        <p>سه دور کامل حول محور افقی؛ نتیجه پیش از پایان چرخش مشخص است.</p>
        <span class="hint">rotateX(1080deg) · 950ms</span>
        <button class="mini-btn" id="coin-btn" type="button">بینداز</button>
      </div>

      <div class="scene">
        <div class="scene-stage"><span class="count" id="count">۰</span></div>
        <h4>شمارندهٔ موجودی</h4>
        <p>عدد درون‌یابی می‌شود، نه اینکه ناگهان جایگزین شود؛ ارقام فارسی و جدول‌عرض‌اند.</p>
        <span class="hint">requestAnimationFrame · 900ms · ease-out</span>
        <button class="mini-btn" id="count-btn" type="button">دوباره بشمار</button>
      </div>

      <div class="scene">
        <div class="scene-stage" style="display:grid;gap:8px;justify-items:center">
          <span class="crash-mult" id="crash-mult">۱٫۰۰×</span>
          <svg class="crash-svg" viewBox="0 0 220 90" aria-hidden="true">
            <path d="M8 84 L212 84 M8 84 L8 6" stroke="var(--line-strong)" stroke-width="2" fill="none"/>
            <path id="crash-path" class="crash-line" d="M8 84 C 70 80, 120 62, 205 10"/>
          </svg>
        </div>
        <h4>منحنی کرش</h4>
        <p>ضریب نمایی بالا می‌رود و در نقطه‌ای تصادفی می‌ایستد؛ خط لحظهٔ کرش قرمز می‌شود.</p>
        <span class="hint">mult = 1.06^(3t)</span>
      </div>

      <div class="scene">
        <div class="scene-stage">
          <div class="xfade">
            <div class="lift-card tok-light">
              <span class="g-icon">${games[3].icon}</span><b>${esc(games[3].name)}</b>
            </div>
            <div class="lift-card tok-dark b">
              <span class="g-icon">${games[3].icon}</span><b>${esc(games[3].name)}</b>
            </div>
          </div>
        </div>
        <h4>تعویض تم</h4>
        <p>یک کارت، دو مجموعه توکن. هیچ ساختاری عوض نمی‌شود؛ فقط مقدار متغیرها.</p>
        <span class="hint">--surface · --line · --turq · --gold-grad</span>
      </div>

    </div>
  </section>

  <!-- ۶. فریم‌ها -->
  <section class="wrap sec" id="screens">
    <div class="sec-head">
      <div class="sec-num">۰۵ — SCREENS</div>
      <h2>چهل فریم واقعی</h2>
      <p>
        از اینجا به بعد همه‌چیز عکس است: فریم‌های گرفته‌شده از اپِ در حال اجرا،
        بدون دست‌کاری. زیر هر فریم یک جمله دربارهٔ چیزی که در همان فریم دیده
        می‌شود آمده — نه توضیح دوبارهٔ عنوانش.
      </p>
    </div>
    ${actsHtml}
  </section>

  <!-- ۷. روش -->
  <section class="wrap sec" id="method">
    <div class="sec-head">
      <div class="sec-num">۰۶ — METHOD</div>
      <h2>این‌ها چطور گرفته شدند</h2>
      <p>هیچ فریمی روتوش نشده است؛ نه برش، نه اصلاح رنگ، نه ترکیب دو عکس.</p>
    </div>
    <dl class="method">
      <div><dt>کامیت</dt><dd>${ltr(commit)}</dd></div>
      <div><dt>ابزار</dt><dd>${ltr("Playwright")} + ${ltr("Chromium")} بدون‌سر</dd></div>
      <div><dt>دسکتاپ</dt><dd>${ltr("1440×900")} با ${ltr("deviceScaleFactor: 1.5")} ← ${ltr("2160×1350")}</dd></div>
      <div><dt>موبایل</dt><dd>پروفایل ${ltr("iPhone 13")} — ${ltr("390×664")} با ${ltr("deviceScaleFactor: 3")} ← ${ltr("1170×1992")}</dd></div>
      <div><dt>تم تاریک</dt><dd>${ltr('colorScheme: "dark"')} واقعی روی کانتکست، نه فیلتر CSS</dd></div>
      <div><dt>قالب</dt><dd>${ltr("JPEG")} با کیفیت ${ltr("80")}؛ در این صفحه ${ltr("data:image/jpeg;base64")}</dd></div>
      <div><dt>سلامت فریم</dt><dd>هر فریم با صفر خطای کنسول و صفر اسکرول افقی تأیید شده</dd></div>
      <div><dt>بازتولید</dt><dd>خودِ این صفحه از روی همان فایل‌ها دوباره ساخته می‌شود</dd></div>
    </dl>
    <div class="cmd"><pre>node scripts/build-betasa-visualization.mjs [shotsDir]
→ betasa/app/visualization.html</pre></div>
    <p class="note" style="margin-top:var(--sp-4)">
      تنها دارایی بیرونی این صفحه فونت است:
      ${ltr("fonts/Vazirmatn-Variable.woff2")} که کنار همین فایل قرار دارد. بقیهٔ
      تصاویر داخل خود ${ltr("HTML")} درون‌ریزی شده‌اند.
    </p>
  </section>
</main>

<footer class="foot">
  <div class="wrap">
    <p>
      بتاسا یک پلتفرم تفریحی رایگان است — تمام بازی‌ها با سکهٔ مجازی انجام می‌شود
      و هیچ پول واقعی، واریز، برداشت یا جایزهٔ نقدی در کار نیست.
    </p>
    <p class="sig">بتاسا · PWA v1 · کانسپت «لوکس ایرانی» · کامیت ${esc(commit)}</p>
  </div>
</footer>

<script>
(function(){
  var root = document.documentElement;
  try{
    var t = localStorage.getItem("betasa-viz-theme");
    if(t === "dark" || t === "light") root.dataset.theme = t;
  }catch(e){}

  document.getElementById("theme-toggle").addEventListener("click", function(){
    var cur = root.dataset.theme;
    if(!cur){
      cur = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    var next = cur === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try{ localStorage.setItem("betasa-viz-theme", next); }catch(e){}
  });

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- سکه --- */
  var coin = document.getElementById("coin");
  document.getElementById("coin-btn").addEventListener("click", function(){
    if(reduced) return;
    coin.classList.remove("spin");
    void coin.offsetWidth;
    coin.classList.add("spin");
  });

  /* --- شمارنده --- */
  var out = document.getElementById("count");
  var FA = "۰۱۲۳۴۵۶۷۸۹";
  function fmt(n){
    var s = String(Math.round(n));
    var g = "";
    for(var i = 0; i < s.length; i++){
      if(i > 0 && (s.length - i) % 3 === 0) g += "\\u2019";
      g += FA.charAt(+s.charAt(i));
    }
    return g;
  }
  var countRaf = 0;
  function countUp(){
    cancelAnimationFrame(countRaf);
    if(reduced){ out.textContent = fmt(12500); return; }
    var t0 = performance.now(), dur = 900;
    (function step(now){
      var p = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      out.textContent = fmt(12500 * e);
      if(p < 1) countRaf = requestAnimationFrame(step);
    })(t0);
  }
  document.getElementById("count-btn").addEventListener("click", countUp);

  /* --- منحنی کرش --- */
  var path = document.getElementById("crash-path");
  var mult = document.getElementById("crash-mult");
  try{
    var len = path.getTotalLength();
    path.style.setProperty("--len", len.toFixed(1));
  }catch(e){}
  function faDec(n){
    return n.toFixed(2).replace(".", "\\u066B").replace(/[0-9]/g, function(d){ return FA.charAt(+d); });
  }
  var crashT0 = 0;
  function crashLoop(now){
    if(!crashT0) crashT0 = now;
    var t = ((now - crashT0) % 2600) / 1000;
    var m = Math.pow(1.06, Math.min(t, 2.03) * 3);
    mult.textContent = faDec(m) + "\\u00d7";
    requestAnimationFrame(crashLoop);
  }

  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(!en.isIntersecting) return;
      io.unobserve(en.target);
      if(en.target.id === "count"){ countUp(); }
      if(en.target.id === "crash-path" && !reduced){
        path.classList.add("run");
        requestAnimationFrame(crashLoop);
      }
    });
  }, { threshold: .3 });
  io.observe(out);
  io.observe(path);

  /* برای بازرسی خودکار: صحنه‌ها را می‌توان مستقیم صدا زد */
  window.__betasaViz = { countUp: countUp, reduced: reduced };
})();
</script>
`;

fs.writeFileSync(OUT, html, "utf8");
const kb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
console.log("✓ نوشته شد: " + OUT);
console.log("  فریم‌ها: " + expected.length + " · توکن رنگ: " + COLOR_ORDER.length + " · آیکون: " + games.length);
console.log("  حجم: " + kb + " MB · کامیت: " + commit);
