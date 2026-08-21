/**
 * Brand asset generator (§2.2, §2.6).
 *
 *   pnpm brand:assets
 *
 * Writes into /public:
 *   brand/logo-mark.svg · logo-mono.svg · logo-lockup-{en,fa}.svg · favicon.svg
 *   brand/icon-192.png · icon-512.png · maskable-512.png · apple-touch-icon.png
 *   brand/og-image-{fa,en}.png (1200×630)
 *   icons/currency/{CODE}.svg + {CODE}.webp (64/128/192 = 1×/2×/3×)
 *
 * Raster output renders through headless Chromium (set CHROMIUM_PATH to
 * override the executable) so Persian text and currency glyphs use the real
 * app fonts, then converts via sharp.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { coinSvg } from "../src/lib/brand/coin-svg";
import { LOGO_STROKES, logoMarkSvg } from "../src/lib/brand/logo-paths";
import { CURRENCY_CODES } from "../src/lib/rates/catalog";

const ROOT = resolve(import.meta.dirname, "..");
const BRAND_DIR = resolve(ROOT, "public/brand");
const COIN_DIR = resolve(ROOT, "public/icons/currency");
const FONT_PATH = resolve(ROOT, "src/fonts/Vazirmatn-Variable.woff2");

const BRAND_600 = "#0b6e4f";
const BRAND_600_DARK = "#12a272";
const INK = "#0a0f14";

function markPaths(color: string, strokeScale = 1): string {
  return LOGO_STROKES.map(
    (s) =>
      `<path d="${s.d}" stroke="${color}" stroke-width="${s.width * strokeScale}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  ).join("");
}

function writeSvgs() {
  mkdirSync(BRAND_DIR, { recursive: true });
  mkdirSync(COIN_DIR, { recursive: true });

  writeFileSync(resolve(BRAND_DIR, "logo-mark.svg"), logoMarkSvg(BRAND_600));
  writeFileSync(resolve(BRAND_DIR, "logo-mono.svg"), logoMarkSvg(INK));

  const favicon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
  <style>path{stroke:${BRAND_600}}@media(prefers-color-scheme:dark){path{stroke:${BRAND_600_DARK}}}</style>
  ${markPaths(BRAND_600)}
</svg>`;
  writeFileSync(resolve(BRAND_DIR, "favicon.svg"), favicon);

  const lockup = (text: string, rtl: boolean, fontFamily: string) => {
    const w = 168;
    const markX = rtl ? w - 30 : 0;
    const textX = rtl ? w - 38 : 38;
    return `<svg viewBox="0 0 ${w} 32" xmlns="http://www.w3.org/2000/svg" fill="none">
  <g transform="translate(${markX},4) scale(1.05)">${markPaths(BRAND_600)}</g>
  <text x="${textX}" y="22" font-family="${fontFamily}" font-size="19" font-weight="700" fill="${INK}"${rtl ? ' text-anchor="end" direction="rtl"' : ""}>${text}</text>
</svg>`;
  };
  writeFileSync(
    resolve(BRAND_DIR, "logo-lockup-en.svg"),
    lockup("Asaex", false, "Inter, Vazirmatn, sans-serif"),
  );
  writeFileSync(
    resolve(BRAND_DIR, "logo-lockup-fa.svg"),
    lockup("صرافی آسا", true, "Vazirmatn, sans-serif"),
  );

  for (const code of CURRENCY_CODES) {
    writeFileSync(resolve(COIN_DIR, `${code}.svg`), coinSvg(code, `x${code}`));
  }
}

function iconComposition(size: number, opts: { maskable?: boolean; radiusPct?: number }): string {
  const pad = opts.maskable ? size * 0.24 : size * 0.18;
  const inner = size - pad * 2;
  const rx = opts.maskable ? 0 : size * (opts.radiusPct ?? 0.22);
  return `<div style="width:${size}px;height:${size}px;position:relative;background:linear-gradient(135deg,#0d7c59 0%,#0b6e4f 55%,#095a41 100%);border-radius:${rx}px;overflow:hidden">
    <svg viewBox="0 0 24 24" style="position:absolute;inset:${pad}px" width="${inner}" height="${inner}" fill="none">${markPaths("#ffffff")}</svg>
  </div>`;
}

function ogComposition(locale: "fa" | "en"): string {
  const fa = locale === "fa";
  const title = fa ? "ارز، به سادگی آسا" : "Currency, made effortless";
  const sub = fa
    ? "بازارگاه حواله میان صرافی‌های دارای مجوز — نرخ زنده، کارمزد شفاف، تسویه نظارت‌شده"
    : "A remittance marketplace between licensed exchange offices — live rates, transparent fees, supervised settlement";
  const word = fa ? "صرافی آسا" : "Asaex";
  return `<div dir="${fa ? "rtl" : "ltr"}" style="width:1200px;height:630px;position:relative;display:flex;flex-direction:column;justify-content:space-between;padding:72px;background:linear-gradient(135deg,#0d7c59 0%,#0b6e4f 55%,#08432f 100%);color:#fff;font-family:Vazirmatn,Inter,sans-serif">
    <div style="display:flex;align-items:center;gap:20px">
      <svg viewBox="0 0 24 24" width="72" height="72" fill="none">${markPaths("#ffffff")}</svg>
      <span style="font-size:44px;font-weight:700">${word}</span>
    </div>
    <div>
      <div style="font-size:76px;font-weight:800;line-height:1.25">${title}</div>
      <div style="font-size:30px;margin-top:24px;opacity:.85;line-height:1.7;max-width:980px">${sub}</div>
    </div>
    <div style="display:flex;gap:12px;opacity:.9;font-size:24px">
      <span style="background:rgba(255,255,255,.14);border-radius:999px;padding:10px 26px">USD</span>
      <span style="background:rgba(255,255,255,.14);border-radius:999px;padding:10px 26px">EUR</span>
      <span style="background:rgba(255,255,255,.14);border-radius:999px;padding:10px 26px">AED</span>
      <span style="background:rgba(255,255,255,.14);border-radius:999px;padding:10px 26px">TRY</span>
      <span style="background:rgba(255,255,255,.14);border-radius:999px;padding:10px 26px">⇄ IRT</span>
    </div>
  </div>`;
}

async function renderRasters() {
  const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
  const browser = await chromium.launch(
    existsSync(executablePath) ? { executablePath } : undefined,
  );
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  const coins = CURRENCY_CODES.map(
    (code) =>
      `<div id="coin-${code}" style="width:192px;height:192px">${coinSvg(code, `r${code}`)}</div>`,
  ).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Vazirmatn;src:url("file://${FONT_PATH}") format("woff2");font-weight:100 900}
    *{margin:0;box-sizing:border-box} body{background:transparent;font-family:Vazirmatn,sans-serif}
    .row{display:flex;flex-wrap:wrap;gap:8px;padding:8px}
  </style></head><body>
    <div class="row">
      <div id="icon-192">${iconComposition(192, {})}</div>
      <div id="icon-512">${iconComposition(512, {})}</div>
      <div id="maskable-512">${iconComposition(512, { maskable: true })}</div>
      <div id="apple-180">${iconComposition(180, { radiusPct: 0 })}</div>
    </div>
    <div class="row">${coins}</div>
    <div class="row"><div id="og-fa">${ogComposition("fa")}</div></div>
    <div class="row"><div id="og-en">${ogComposition("en")}</div></div>
  </body></html>`;

  await page.setContent(html, { waitUntil: "networkidle" });

  async function shot(id: string): Promise<Buffer> {
    const el = page.locator(`#${id}`);
    return await el.screenshot({ omitBackground: true, type: "png" });
  }

  writeFileSync(resolve(BRAND_DIR, "icon-192.png"), await shot("icon-192"));
  writeFileSync(resolve(BRAND_DIR, "icon-512.png"), await shot("icon-512"));
  writeFileSync(resolve(BRAND_DIR, "maskable-512.png"), await shot("maskable-512"));
  writeFileSync(resolve(BRAND_DIR, "apple-touch-icon.png"), await shot("apple-180"));
  writeFileSync(resolve(BRAND_DIR, "og-image-fa.png"), await shot("og-fa"));
  writeFileSync(resolve(BRAND_DIR, "og-image-en.png"), await shot("og-en"));

  for (const code of CURRENCY_CODES) {
    const png = await shot(`coin-${code}`);
    for (const [suffix, size] of [
      ["", 64],
      ["@2x", 128],
      ["@3x", 192],
    ] as const) {
      const webp = await sharp(png).resize(size, size).webp({ quality: 88 }).toBuffer();
      writeFileSync(resolve(COIN_DIR, `${code}${suffix}.webp`), webp);
    }
  }

  await browser.close();
}

writeSvgs();
console.log("✓ SVG brand assets written");
await renderRasters();
console.log("✓ Raster icons, coins, and OG images written");
