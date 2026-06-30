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
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '历史对话' }).click();
  await page.waitForTimeout(800);

  const followBtns = page.locator('.ly-history-followups button');
  const qCount = await followBtns.count();
  let qText = '';
  if (qCount > 0) {
    qText = (await followBtns.nth(0).textContent())?.trim() || '';
    await followBtns.nth(0).click();
    await page.waitForTimeout(1700);
  }

  const section = page.locator('.ly-main').textContent();
  const currentSection = await page.locator('.ly-main .ly-heading strong').textContent().catch(() => '');
  const chatSection = await page.locator('.ly-chat-workspace').isVisible().catch(() => false);
  const hasChatInput = await page.locator('.ly-input-shell').isVisible().catch(() => false);
  const apiMsg = events.filter((x) => x.includes('/api/chat/message')).length;

  console.log(JSON.stringify({
    qCount,
    qText,
    currentSection: (await section).trim().slice(0, 220),
    hasHistoryTitle: (await currentSection?.trim?.()) || '',
    chatSection,
    hasChatInput,
    events,
    apiMsg
  }, null, 2));

  await browser.close();
})();
