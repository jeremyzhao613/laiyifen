import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];

  page.on('request', req => {
    if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`);
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.locator('textarea').first().fill('我想补传营业执照，在哪里操作？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(6000);

  const allBtnText = await page.locator('button').allTextContents();
  const candidates = allBtnText.filter((t) => (t || '').trim() === '生成客服工单');

  const hadButton = candidates.length > 0;
  if (!hadButton) {
    console.log(JSON.stringify({ events, hadButton, message: 'not found' }, null, 2));
    await browser.close();
    return;
  }

  // click the action by text exactly
  await page.getByRole('button', { name: '生成客服工单' }).click();
  await page.waitForTimeout(1400);

  const hasTransferred = await page.locator('.ly-transfer strong').textContent();
  const hasTicketText = await page.locator('text=/工单/').count();

  console.log(JSON.stringify({
    events,
    hadButton,
    candidates,
    transferLabel: hasTransferred?.trim(),
    hasTicketText,
    ticketActions: events.filter((x) => x.startsWith('POST')).filter((x) => x.includes('/api/tickets'))
  }, null, 2));

  await browser.close();
})();
