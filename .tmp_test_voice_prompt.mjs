import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];

  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });
  page.on('response', res => { if (res.url().includes('/api/')) events.push(`RESP ${res.status()} ${res.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const msgCount0 = await page.locator('.ly-message').count();
  await page.locator('.ly-tool.muted').last().click();
  await page.waitForTimeout(1200);

  const hint = await page.locator('.ly-input-hint').textContent();
  const msgCount1 = await page.locator('.ly-message').count();

  const systemMsg = await page.locator('.ly-message').nth(-1).textContent().catch(() => '');
  const msgTextAll = await page.locator('.ly-message .ly-message-text, .ly-message p').allTextContents().catch(() => []);

  console.log(JSON.stringify({
    events,
    msgCount0,
    msgCount1,
    hint: hint?.trim(),
    totalMessages: msgTextAll,
    systemLast: systemMsg
  }, null, 2));

  await browser.close();
})();
