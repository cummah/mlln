// Usage: node scripts/responsive/clip.mjs <route> <out.png> <y> <height> [width] — one slice of a long page.
import { chromium } from 'playwright';
const [route, out, y, h, w = '375'] = process.argv.slice(2);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: +w, height: +y + +h } })).newPage();
await p.goto('http://localhost:3001' + route, { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
await p.screenshot({ path: out, clip: { x: 0, y: +y, width: +w, height: +h } });
await b.close();
