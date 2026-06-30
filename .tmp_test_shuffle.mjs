import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const events = [];
  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const firstSet = await page.locator('.ly-question-grid button span').allTextContents();
  await page.locator('button:has-text("换一换")').click();
  await page.waitForTimeout(500);
  const secondSet = await page.locator('.ly-question-grid button span').allTextContents();

  await page.locator('button:has-text("换一换")').click();
  await page.waitForTimeout(500);
  const thirdSet = await page.locator('.ly-question-grid button span').allTextContents();

  console.log(JSON.stringify({
    firstSet,
    secondSet,
    thirdSet,
    apiCalls: events.filter((x) => x.includes('/api/'))
  }, null, 2));

  await browser.close();
})();
