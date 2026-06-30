import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];
  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });
  page.on('response', res => { if (res.url().includes('/api/')) events.push(`RESP ${res.status()} ${res.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: '历史对话' }).click();
  await page.waitForTimeout(800);

  const firstRecord = page.locator('.ly-history-list .ly-history-item').first();
  const firstText = await firstRecord.textContent().catch(() => '');
  await firstRecord.click();
  await page.waitForTimeout(800);

  const filterButtons = page.locator('.ly-history-filter button');
  const serviceCount = await filterButtons.count();
  const serviceBtn = filterButtons.filter({ hasText: '客服对话' });
  if ((await serviceBtn.count()) > 0) await serviceBtn.first().click();
  await page.waitForTimeout(600);

  const detailQuestions = page.locator('.ly-history-followups button');
  const qCount = await detailQuestions.count();
  let qText = '';
  if (qCount > 0) {
    qText = (await detailQuestions.nth(0).textContent()) || '';
    await detailQuestions.nth(0).click();
  }
  await page.waitForTimeout(1600);

  const sectionText = await page.locator('.ly-main > .ly-message-stack').count().catch(() => 0);
  const latestMsg = await page.locator('.ly-message-stack .ly-message').allTextContents().catch(() => []);

  console.log(JSON.stringify({
    events,
    firstText: firstText?.replace(/\s+/g, ' ').trim(),
    serviceCount,
    qCount,
    qText: qText.trim(),
    detailMessages: latestMsg,
    sectionText,
    apiPostMessage: events.filter((x) => x.startsWith('POST') && x.includes('/api/chat/message')).length,
    apiTicket: events.filter((x) => x.startsWith('POST') && x.includes('/api/tickets')).length
  }, null, 2));

  await browser.close();
})();
