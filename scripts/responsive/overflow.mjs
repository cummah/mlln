// Usage: node scripts/responsive/overflow.mjs <route> [width] — lists the outermost overflowing elements.
import { chromium } from 'playwright';
const [route = '/', width = '375'] = process.argv.slice(2);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: +width, height: 812 } })).newPage();
await p.goto('http://localhost:3001' + route, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
console.log(await p.evaluate(() => {
  const w = window.innerWidth;
  const clipped = (el) => { for (let q = el.parentElement; q; q = q.parentElement) { const o = getComputedStyle(q).overflowX; if (['auto','scroll','hidden'].includes(o)) return q.getBoundingClientRect().right <= w + 1; } return false; };
  const bad = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > w + 1 && getComputedStyle(e).position !== 'fixed' && !clipped(e); });
  const set = new Set(bad);
  return bad.filter((e) => !set.has(e.parentElement)).slice(0, 15).map((e) => `${e.tagName}.${(e.className+'').slice(0,40)} right=${Math.round(e.getBoundingClientRect().right)} text="${e.textContent.trim().slice(0,40)}"`).join('\n') + `\ntotal=${bad.length}`;
}));
await p.screenshot({ path: '.responsive/full.png', fullPage: true });
await b.close();
