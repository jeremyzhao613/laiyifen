import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];

  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.selectOption('select', { label: '加盟商' });
  await page.locator('textarea').first().fill('我这边还有哪些待办没处理？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(900);

  await page.getByRole('button', { name: '新建对话' }).click();
  await page.waitForTimeout(500);

  await page.selectOption('select', { label: '员工' });
  await page.locator('textarea').first().fill('今天还有哪些客户待回访？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(1200);

  const identityNow = await page.locator('select').inputValue();
  const counts = {
    starts: events.filter((x) => x.includes('POST /api/chat/start')).length,
    messages: events.filter((x) => x.includes('POST /api/chat/message')).length
  };
  const userMsgs = await page.locator('.ly-message.user').allTextContents();

  console.log(JSON.stringify({
    events,
    identityNow,
    counts,
    userMsgs
  }, null, 2));

  await browser.close();
})();
