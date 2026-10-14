// Usage: node scripts/responsive/shots.mjs <outDir> [baseUrl]
// Screenshots every route at desktop/tablet/mobile and reports horizontal overflow.
// Desktop regression check: run once into a baseline dir, again after changes, then
//   node scripts/responsive/shots.mjs --compare <dirA> <dirB>
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROUTES = ['/', '/asset/daily', '/asset/weekly', '/asset/monthly', '/asset/aapl',
  '/sectors', '/rank', '/watchlist', '/portfolio', '/methodology', '/privacy', '/score-criteria'];
const VIEWPORTS = { desktop: [1440, 900], tablet: [768, 1024], mobile: [375, 812] };

if (process.argv[2] === '--compare') {
  const [a, b] = process.argv.slice(3);
  const hash = (f) => createHash('md5').update(readFileSync(f)).digest('hex');
  let diffs = 0;
  for (const f of readdirSync(a).filter((n) => n.startsWith('desktop'))) {
    let same = false;
    try { same = hash(join(a, f)) === hash(join(b, f)); } catch {}
    if (!same) { diffs++; console.log('DIFF', f); }
  }
  console.log(diffs ? `${diffs} desktop screenshot(s) differ` : 'desktop identical');
  process.exit(diffs ? 1 : 0);
}

const out = process.argv[2] || 'responsive-shots';
const base = process.argv[3] || 'http://localhost:3001';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const report = [];
for (const [vp, [width, height]] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const name = `${vp}${route.replace(/\//g, '_') || '_'}.png`;
    try {
      await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60000 });
      await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}' });
      await page.waitForTimeout(500);
      // Count elements poking past the viewport that aren't inside an intentional scroller/clipper.
      const over = await page.evaluate(() => {
        const w = window.innerWidth;
        const clipped = (el) => {
          for (let p = el.parentElement; p; p = p.parentElement) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return p.getBoundingClientRect().right <= w + 1;
          }
          return false;
        };
        return [...document.querySelectorAll('body *')].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.right > w + 1 && getComputedStyle(e).position !== 'fixed' && !clipped(e);
        }).length;
      });
      await page.screenshot({ path: join(out, name), fullPage: false });
      report.push({ vp, route, overflowingEls: over });
    } catch (e) {
      report.push({ vp, route, error: String(e).slice(0, 120) });
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
console.table(report.filter((r) => r.vp === 'mobile'));
