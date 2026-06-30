import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];

  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });
  page.on('response', res => { if (res.url().includes('/api/')) events.push(`RESP ${res.status()} ${res.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '工单反馈' }).click();
  await page.waitForTimeout(600);

  await page.getByRole('button', { name: '提交工单' }).click();
  await page.waitForTimeout(220);
  const notice1 = (await page.locator('.ly-ticket-notice').textContent().catch(() => ''))?.trim();

  const sel = page.locator('.ly-ticket-form select').first();
  await sel.selectOption({ index: 1 });
  await page.locator('.ly-ticket-form textarea').fill('测试工单提交接口');

  await page.getByRole('button', { name: '提交工单' }).click();
  await page.waitForTimeout(900);

  const notice2 = (await page.locator('.ly-ticket-notice').textContent().catch(() => ''))?.trim();
  const ticketPosts = events.filter((x) => x.startsWith('POST') && x.includes('/api/tickets')).length;
  const listHead = await page.locator('.ly-ticket-list article').first().textContent().catch(() => '');

  console.log(JSON.stringify({
    events,
    notice1,
    notice2,
    hasValidationNotice: /请先填写/.test(notice1 || ''),
    ticketPosts,
    firstListItem: (listHead || '').trim().slice(0, 220)
  }, null, 2));

  await browser.close();
})();
