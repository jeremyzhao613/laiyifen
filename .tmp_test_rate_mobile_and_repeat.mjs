import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const events = [];
  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });
  page.on('response', res => { if (res.url().includes('/api/')) events.push(`RESP ${res.status()} ${res.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.locator('textarea').first().fill('我这边还有哪些待办没处理？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(1400);

  // desktop mobile has separate header but same composer
  const rate = page.locator('.ly-rate');
  const before = await rate.textContent().catch(() => '');
  await rate.click();
  await page.waitForTimeout(500);

  const modalVisible = await page.locator('.ly-rating-overlay').isVisible().catch(() => false);
  const closeButton = page.locator('.ly-rating-close');
  await closeButton.click();
  await page.waitForTimeout(200);
  const modalHidden = await page.locator('.ly-rating-overlay').isVisible().catch(() => false);

  // reopen and submit rating twice
  await rate.click();
  await page.waitForTimeout(300);
  const starCount = await page.locator('.ly-rating-options button').count().catch(() => 0);
  await page.locator('.ly-rating-options button').nth(2).click();
  await page.locator('.ly-rating-submit').click();
  await page.waitForTimeout(400);

  await page.locator('.ly-rate').click();
  await page.waitForTimeout(300);
  const secondStarCount = await page.locator('.ly-rating-options button').count().catch(() => 0);

  console.log(JSON.stringify({
    before: before?.trim(),
    starCount,
    secondStarCount,
    events,
    modalVisible,
    modalHidden
  }, null, 2));

  await browser.close();
})();
