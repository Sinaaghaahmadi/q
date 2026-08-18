/* ══════════════════════════════════════════════════════════════════════════
   extract-theme.js — read a live page's design tokens

   The board is meant to sit next to the Qeymat admin panel without looking
   like a different product. This reads the panel's real computed styles and
   prints a `:root` block that can be pasted straight into index.html.

   HOW TO USE
     1. Open the admin panel in Chrome/Edge, logged in, on the page whose
        look you want to match.
     2. DevTools → Console. If it warns about pasting, type `allow pasting`
        and press Enter first.
     3. Paste this whole file, press Enter.
     4. Copy the CSS block it prints.

   It only READS getComputedStyle and stylesheet variables. It sends nothing
   anywhere, changes nothing on the page, and touches no page data — no
   cookies, tokens, form values, or text content are read.
   ══════════════════════════════════════════════════════════════════════════ */
(() => {
  const MAX_NODES = 5000;

  // --- colour helpers -----------------------------------------------------
  const rgb = str => {
    const m = String(str).match(/-?[\d.]+/g);
    if (!m || m.length < 3) return null;
    const [r, g, b, a = 1] = m.map(Number);
    return { r, g, b, a };
  };
  const hex = c => c && c.a !== 0
    ? '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
    : null;
  // rgb() parses "rgb(r,g,b)"; hex strings need their own parser, or
  // "#e02f43" silently reads as the digits 0,2,4 and every colour test lies.
  const unhex = h => {
    const m = /^#([0-9a-f]{6})$/i.exec(String(h));
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  };
  const lum = c => c ? (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255 : 0;
  const opaque = c => c && c.a >= 0.9;

  // Absolute chroma, not relative saturation. A dark blue-grey like #1b212a
  // is 36% "saturated" by the relative measure but only 15/255 of actual
  // colour — treating it as an accent is how a surface gets mistaken for a
  // brand colour.
  const chroma = c => c ? Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) : 0;
  const vivid  = c => chroma(c) >= 45 && lum(c) > 0.10 && lum(c) < 0.95;

  const isInteractive = el =>
    el.tagName === 'A' || el.tagName === 'BUTTON' ||
    el.getAttribute('role') === 'button' ||
    /(^|\s)(btn|button|badge|tag|chip|active|selected|primary)(\s|$|-)/i.test(el.className || '');

  // --- gather -------------------------------------------------------------
  const nodes = [...document.querySelectorAll('*')].slice(0, MAX_NODES).filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  });

  const bump = (map, key, w = 1) => { if (key) map.set(key, (map.get(key) || 0) + w); };
  const rank = map => [...map].sort((a, b) => b[1] - a[1]);

  const surfaceArea = new Map();   // weighted by painted area, not element count
  const textCount   = new Map();
  const edgeCount   = new Map();
  const radiusBig   = new Map();   // card / sheet corners
  const radiusSmall = new Map();   // control corners
  const shadowCount = new Map();
  const accentScore = new Map();   // weighted by how much the element behaves like a control

  for (const el of nodes) {
    const s = getComputedStyle(el);
    const b = rgb(s.backgroundColor), c = rgb(s.color), o = rgb(s.borderColor);
    const box = el.getBoundingClientRect();
    const area = box.width * box.height;
    const control = isInteractive(el);

    if (opaque(b)) bump(surfaceArea, hex(b), area);
    if (c && c.a > 0.5) bump(textCount, hex(c));
    if (opaque(o) && parseFloat(s.borderTopWidth) > 0) bump(edgeCount, hex(o));
    // A pill (radius >= half the height) says nothing about card corners,
    // and a card's radius must come from card-sized elements, not buttons.
    const rad = Math.round(parseFloat(s.borderTopLeftRadius));
    if (rad > 0 && rad < box.height / 2 && rad < 100) {
      bump(area > 20000 ? radiusBig : radiusSmall, rad);
    }
    if (s.boxShadow && s.boxShadow !== 'none') bump(shadowCount, s.boxShadow);

    // A solid-filled primary button is the strongest accent signal there is;
    // coloured control text is next; a vivid fill anywhere else is weak.
    if (opaque(b) && vivid(b))      bump(accentScore, hex(b), control ? 5 : 1);
    if (control && vivid(c))        bump(accentScore, hex(c), 3);
  }

  // --- any design system already declared as custom properties? -----------
  // If the panel already ships design tokens, these beat every heuristic
  // above — read them first and use the guesses only to fill gaps.
  const declared = {};
  try {
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }   // cross-origin
      for (const r of rules || []) {
        if (!r.style || !/:root|^html$|^body$/.test(r.selectorText || '')) continue;
        for (const prop of r.style) {
          if (prop.startsWith('--')) declared[prop] = r.style.getPropertyValue(prop).trim();
        }
      }
    }
  } catch {}

  const bodyCS = getComputedStyle(document.body);
  const isDark = lum(rgb(bodyCS.backgroundColor)) < 0.4;
  const pageBg = hex(rgb(bodyCS.backgroundColor));

  // surfaces ranked by area, with the page background itself removed so
  // "panel" is the card/sheet colour rather than the page it sits on
  const surfaces = rank(surfaceArea).filter(([h]) => h && h !== pageBg);
  // The price up/down colours are text too, but they are not part of the
  // neutral ramp — keep only low-chroma colours, then order them by
  // luminance so ink -> ink-2 -> ink-3 reads darkest-first (inverted on dark).
  const text = rank(textCount)
    .filter(([h, n]) => h && n >= 2 && chroma(unhex(h)) < 45)
    .sort((a, b) => isDark ? lum(unhex(b[0])) - lum(unhex(a[0])) : lum(unhex(a[0])) - lum(unhex(b[0])));
  const borders  = rank(edgeCount).filter(([h]) => h);
  const radii    = rank(radiusBig);
  const radiiSm  = rank(radiusSmall);
  const accents  = rank(accentScore);
  const shadow   = rank(shadowCount)[0]?.[0] || 'none';
  const accent   = accents[0]?.[0] || null;

  const pct = n => Math.round(n / innerWidth / innerHeight * 100);
  const report = {
    mode:          isDark ? 'dark' : 'light',
    font:          bodyCS.fontFamily,
    fontSize:      bodyCS.fontSize,
    pageBg,
    accent,
    accentRunners: accents.slice(1, 4).map(([h, n]) => `${h} (score ${n})`),
    surfaces:      surfaces.slice(0, 5).map(([h, a]) => `${h} (~${pct(a)}% of a screen)`),
    text:          text.slice(0, 4).map(([h, n]) => `${h} ×${n}`),
    borders:       borders.slice(0, 3).map(([h, n]) => `${h} ×${n}`),
    radii:         [...radii.slice(0,2), ...radiiSm.slice(0,2)].map(([v, n]) => `${v}px ×${n}`),
    shadow,
    customProps:   Object.keys(declared).length ? declared : '(none found — or stylesheets are cross-origin)',
  };

  const sfx = isDark ? '-dk' : '';
  const css = `
:root{
  --brand-font:${bodyCS.fontFamily};
  --brand-size:${bodyCS.fontSize};

  --brand-accent${sfx}:${accent || '/* not detected — pick from accentRunners */'};

  --brand-bg${sfx}:${pageBg};
  --brand-panel${sfx}:${surfaces[0]?.[0] || '?'};
  --brand-panel-2${sfx}:${surfaces[1]?.[0] || '?'};
  --brand-line${sfx}:${borders[0]?.[0] || '?'};
  --brand-ink${sfx}:${text[0]?.[0] || '?'};
  --brand-ink-2${sfx}:${text[1]?.[0] || '?'};
  --brand-ink-3${sfx}:${text[2]?.[0] || '?'};

  --brand-radius:${radii[0]?.[0] ?? 14}px;
  --brand-radius-sm:${radiiSm[0]?.[0] ?? 10}px;

  --brand-shadow${sfx}:${shadow};
}`.trim();
  report.css = css;

  console.log('%c Qeymat — theme extracted ', 'background:#3563e9;color:#fff;padding:2px 6px;border-radius:4px');
  console.log(`Sampled ${nodes.length} visible elements. Detected mode: ${report.mode}.`);
  console.table(report);
  console.log('\n%cPaste this into index.html:', 'font-weight:bold');
  console.log(css);
  console.log('\nRun this again with the panel in its OTHER theme to fill in the missing half.');

  try { copy(css); console.log('%c(copied to clipboard)', 'color:#0f9d58'); } catch {}
  return report;
})();
