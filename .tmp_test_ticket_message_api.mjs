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
  await page.waitForTimeout(1100);

  // 1) create manual ticket via transfer
  await page.locator('textarea').first().fill('我想补传营业执照，在哪里操作？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(1200);

  await page.locator('.ly-transfer').click();
  await page.locator('.ly-service-popover button').click();
  await page.waitForTimeout(1200);

  // 2) send message in manual service mode
  await page.locator('textarea').first().fill('请帮我检查补传按钮路径是否正常');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(1500);

  const hasTicketPath = events.filter((x) => x.includes('/api/tickets/') && x.includes('/messages') && x.startsWith('POST')).length;
  const hasError = await page.locator('.ly-message').locator('text=/发送失败|未读取|错误/').count();
  const lastSystemOrStaff = await page.locator('.ly-message').last().textContent().catch(() => '');

  console.log(JSON.stringify({
    events: events.filter((x) => x.includes('/api/')),
    hasTicketPath,
    hasError,
    lastSystemOrStaff: lastSystemOrStaff?.trim().slice(0, 220)
  }, null, 2));

  await browser.close();
})();
