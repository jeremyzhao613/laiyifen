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

  // send a normal question then click message-level transfer in assistant bubble first
  await page.locator('textarea').first().fill('我这边还有哪些待办没处理？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(1800);

  const messageTransfer = page.locator('.ly-actions button:has-text("转人工客服")').first();
  const msgLabel = await messageTransfer.textContent();
  await messageTransfer.click();
  await page.waitForTimeout(1200);

  // click composer transfer immediately after
  const composerTransfer = page.locator('.ly-transfer');
  const composerLabel = await composerTransfer.textContent();
  await composerTransfer.click();
  await page.waitForTimeout(1800);

  const hasManualInViewport = await page.locator('text=/当前客服：|转人工客服|工单号/').count();
  const composerTransferText = await page.locator('.ly-transfer').first().textContent();
  const tipText = await page.getByText(/继续转人工|请先发送一个问题|当前客服/).count();

  console.log(JSON.stringify({
    events,
    msgLabel: msgLabel?.trim(),
    composerLabel: composerLabel?.trim(),
    hasManualInViewport,
    tipText,
    composerTransferText,
    url: page.url()
  }, null, 2));

  await browser.close();
})();
