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
  await page.waitForTimeout(1200);

  // click new chat
  await page.getByRole('button', { name: '新建对话' }).click();
  await page.waitForTimeout(500);

  await page.locator('textarea').first().fill('供应商资料提交后多久能审核完？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(1200);

  // summarize API calls
  const starts = events.filter((x) => x.startsWith('POST') && x.includes('/api/chat/start')).length;
  const messages = events.filter((x) => x.startsWith('POST') && x.includes('/api/chat/message')).length;
  const ticketCalls = events.filter((x) => x.startsWith('POST') && x.includes('/api/tickets')).length;

  console.log(JSON.stringify({
    events,
    starts,
    messages,
    ticketCalls
  }, null, 2));

  await browser.close();
})();
