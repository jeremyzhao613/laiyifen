import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      events.push(`${req.method()} ${req.url()}`);
    }
  });
  page.on('response', res => {
    if (res.url().includes('/api/')) {
      events.push(`RESP ${res.status()} ${res.url()}`);
    }
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.locator('textarea').first().fill('给我看一下后台数据客服 · 1d');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(2000);

  const transferBtn = page.getByRole('button', { name: '转人工客服' });
  await transferBtn.waitFor({ state: 'visible', timeout: 5000 });
  await transferBtn.click();
  await page.waitForTimeout(1800);

  const containsManual = await page.locator('text=工单').count();
  const containsTicket = await page.locator('text=/TK-/').count();
  const lastMessages = await page.locator('.ly-message').count();
  console.log(JSON.stringify({ events, containsManual, containsTicket, lastMessages, url: page.url() }, null, 2));
  await browser.close();
})();
