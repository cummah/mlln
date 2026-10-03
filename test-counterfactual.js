const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate to daily page
  await page.goto('http://localhost:3002/asset/daily', { waitUntil: 'networkidle' });

  // Wait for the page to load
  await page.waitForTimeout(2000);

  // Scroll to see if we can find the Exit Score column and the new Return Since Exit column
  const headers = await page.locator('th').allTextContents();
  console.log('Table headers found:');
  headers.forEach((h, i) => console.log(`  ${i}: ${h}`));

  const hasReturnSinceExit = headers.some(h => h.includes('Return Since Exit'));
  console.log(`\n✓ "Return Since Exit" column present: ${hasReturnSinceExit}`);

  // Take a screenshot
  await page.screenshot({ path: 'screenshot-daily.png', fullPage: true });
  console.log('Screenshot saved: screenshot-daily.png');

  await browser.close();
})().catch(console.error);
