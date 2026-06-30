import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];

  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });
  page.on('response', res => { if (res.url().includes('/api/')) events.push(`RESP ${res.status()} ${res.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.locator('textarea').first().fill('我这边还有哪些待办没处理？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(2000);

  await page.locator('.ly-rate').click();
  await page.waitForTimeout(400);

  const ratingButton = page.locator('.ly-rating-options button').nth(4); // score 5
  await ratingButton.click();
  await page.locator('.ly-rating-submit').click();
  await page.waitForTimeout(1500);

  const hasRated = await page.getByText(/已提交本次服务评价/).count();
  const modalAfter = await page.locator('.ly-rating-overlay').count();

  console.log(JSON.stringify({
    events,
    hasRated,
    modalAfter
  }, null, 2));
  await browser.close();
})();
