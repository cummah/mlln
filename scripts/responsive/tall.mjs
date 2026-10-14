// Usage: node scripts/responsive/tall.mjs <route> <out.png> [width] [height] — tall viewport, since the shell scrolls internally.
import { chromium } from 'playwright';
const [route, out, w = '375', h = '2600'] = process.argv.slice(2);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
await p.goto('http://localhost:3001' + route, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
await p.screenshot({ path: out });
await b.close();
