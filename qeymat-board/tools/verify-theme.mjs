import { chromium } from 'playwright';

// Resolve the board relative to this script so the check runs from any
// checkout, not just the container it was written in.
const INDEX_URL = new URL('../index.html', import.meta.url).href;
const ADMIN = {
  light:{ background:'#f5f6f2', surface:'#ffffff', 'surface-soft':'#eef0eb', border:'#e2e5df',
          text:'#151916', 'text-secondary':'#6e746e', 'text-muted':'#9ba09a',
          accent:'#286c4a', 'accent-soft':'#e4f1e9', positive:'#25805a', negative:'#b84f5a' },
  dark: { background:'#0f1210', surface:'#181c19', 'surface-soft':'#222723', border:'#2d332e',
          text:'#f2f4ef', 'text-secondary':'#a5aba4', 'text-muted':'#777d77',
          accent:'#71c897', 'accent-soft':'#1c3427', positive:'#72cc99', negative:'#ef7e89' },
};
const MAP = { background:'--bg', surface:'--panel', 'surface-soft':'--panel-2', border:'--line',
  text:'--ink', 'text-secondary':'--ink-2', 'text-muted':'--ink-3',
  accent:'--accent', 'accent-soft':'--accent-soft', positive:'--up', negative:'--down' };

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let fail = 0;
for (const scheme of ['light','dark']){
  const ctx = await b.newContext({ viewport:{width:1240,height:800}, colorScheme:scheme });
  const p = await ctx.newPage();
  await p.goto(INDEX_URL);
  await p.waitForSelector('.card');
  const got = await p.evaluate(vars => {
    const cs = getComputedStyle(document.documentElement);
    const out = {};
    for (const v of vars) out[v] = cs.getPropertyValue(v).trim();
    return out;
  }, Object.values(MAP));
  console.log(`\n── ${scheme} ──`);
  for (const [adminName, boardVar] of Object.entries(MAP)){
    const want = ADMIN[scheme][adminName].toLowerCase();
    const have = got[boardVar].toLowerCase();
    const ok = have === want;
    if (!ok) fail++;
    console.log(`${ok?'  ok  ':'  XX  '} --${adminName.padEnd(15)} ${want}  ->  ${boardVar.padEnd(14)} ${have}`);
  }
  const font = await p.evaluate(() => getComputedStyle(document.body).fontFamily);
  const rad  = await p.evaluate(() => getComputedStyle(document.querySelector('.card')).borderRadius);
  console.log(`  font: ${font.slice(0,30)} | card radius: ${rad}`);
  await ctx.close();
}
console.log(fail ? `\n${fail} MISMATCH` : '\nall tokens match the admin panel');
await b.close();
// Without a non-zero exit a scripted or CI run of this "assertion" can never
// fail, which defeats its purpose.
process.exitCode = fail ? 1 : 0;
