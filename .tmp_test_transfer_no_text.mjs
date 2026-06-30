import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];

  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });
  page.on('response', res => { if (res.url().includes('/api/')) events.push(`RESP ${res.status()} ${res.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.locator('.ly-transfer').click();
  await page.waitForTimeout(250);
  await page.locator('.ly-service-popover button').click();
  await page.waitForTimeout(1200);

  const transferLabel = await page.locator('.ly-transfer strong').textContent().catch(() => '');
  const lastSystem = await page.locator('.ly-message').last().textContent().catch(() => '');

  console.log(JSON.stringify({
    events,
    transferLabel: transferLabel?.trim(),
    lastSystem: lastSystem?.trim(),
    hasNoUserMessage: lastSystem.includes('用户请求转人工')
  }, null, 2));

  await browser.close();
})();
