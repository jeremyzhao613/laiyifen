import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];

  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });
  page.on('response', res => { if (res.url().includes('/api/')) events.push(`RESP ${res.status()} ${res.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // send one message to have context
  await page.locator('textarea').first().fill('我这边还有哪些待办没处理？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(1200);

  const defaultIdentity = await page.locator('select').inputValue();

  // open dropdown by selecting new identity
  await page.selectOption('select', { label: '加盟商' });
  await page.waitForTimeout(700);

  await page.locator('textarea').first().fill('我想补传营业执照，在哪里操作？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(1200);

  const currentIdentity = await page.locator('select').inputValue();
  const postStarts = events.filter((x) => x.includes('POST /api/chat/start')).length;
  const postMessages = events.filter((x) => x.includes('POST /api/chat/message')).length;
  const firstMsgTexts = await page.locator('.ly-message.user').allTextContents().catch(() => []);

  console.log(JSON.stringify({
    events,
    defaultIdentity,
    currentIdentity,
    postStarts,
    postMessages,
    firstMsgTexts
  }, null, 2));

  await browser.close();
})();
