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

  await page.locator('textarea').first().fill('我这边还有哪些待办没处理？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(1800);

  const composerBtn = page.locator('.ly-transfer');
  const composerTextBefore = await composerBtn.textContent();
  await composerBtn.click();
  await page.waitForTimeout(2000);
  const composerTextAfter = await composerBtn.textContent();

  const containsCreated = await page.locator('text=/TK-/').count();

  console.log(JSON.stringify({
    composerTextBefore: composerTextBefore?.trim(),
    composerTextAfter: composerTextAfter?.trim(),
    containsCreated,
    events
  }, null, 2));

  await browser.close();
})();
