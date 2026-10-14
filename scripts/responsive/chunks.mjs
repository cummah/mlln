// Usage: node scripts/responsive/chunks.mjs <route> <outPrefix> [width] [chunkHeight] [total] — readable slices of a long page.
import { chromium } from 'playwright';
const [route, prefix, w = '375', ch = '1100', total = '6000'] = process.argv.slice(2);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: +w, height: +total } })).newPage();
await p.goto('http://localhost:3001' + route, { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
const h = await p.evaluate(() => Math.max(...[...document.querySelectorAll('body *')].map((e) => e.getBoundingClientRect().bottom)));
for (let y = 0, i = 0; y < Math.min(h, +total); y += +ch, i++) await p.screenshot({ path: `${prefix}${i}.png`, clip: { x: 0, y, width: +w, height: Math.min(+ch, +total - y) } });
console.log('content height', Math.round(h));
await b.close();
