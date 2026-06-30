import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];

  page.on('request', req => {
    if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`);
  });
  page.on('response', res => {
    if (res.url().includes('/api/')) events.push(`RESP ${res.status()} ${res.url()}`);
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.locator('textarea').first().fill('给我看一下后台数据客服 · 1d');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(2000);

  const rateBtn = page.locator('.ly-actions button:has-text("评价服务")');
  await rateBtn.waitFor({state:'visible', timeout: 5000});
  await rateBtn.click();

  const ratingModalVisible = await page.locator('.ly-rating-overlay').isVisible().catch(() => false);
  const starButtons = await page.locator('.ly-rating-options button').count().catch(() => 0);
  const closeText = await page.locator('.ly-rating-close').isVisible().catch(() => false);

  console.log(JSON.stringify({
    events,
    ratingModalVisible,
    starButtons,
    closeText,
    url: page.url()
  }, null, 2));

  await browser.close();
})();
