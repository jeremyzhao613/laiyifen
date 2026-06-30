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

  await page.locator('textarea').first().fill('合同授权卡在待确认，下一步怎么做？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(1800);

  // step1 open transfer popover
  await page.locator('.ly-transfer').click();
  await page.waitForTimeout(400);

  const popoverText = await page.locator('.ly-service-popover span').first().textContent().catch(() => '');
  const continueBtn = page.locator('.ly-service-popover button');
  const continueText = await continueBtn.textContent();
  await continueBtn.click();
  await page.waitForTimeout(1400);

  const transferBtnText = await page.locator('.ly-transfer strong').textContent();
  const hasTicketTag = await page.locator('text=/TK-/').count();
  const latestMessage = await page.locator('.ly-message-text, .ly-message').last().textContent().catch(() => '');

  console.log(JSON.stringify({
    events,
    popoverText: popoverText?.trim(),
    continueText: continueText?.trim(),
    transferBtnText: transferBtnText?.trim(),
    hasTicketTag,
    latestMessage: typeof latestMessage === 'string' ? latestMessage.trim().slice(0, 200) : ''
  }, null, 2));

  await browser.close();
})();
