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
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: '提交工单' }).click();
  await page.waitForTimeout(200);
  const notice1 = (await page.locator('.ly-ticket-notice').textContent().catch(() => ''))?.trim();

  const sels = page.locator('.ly-ticket-form select');
  const nSel = await sels.count();
  await sels.nth(0).selectOption({ index: 1 });

  const ta = page.locator('.ly-ticket-form textarea');
  await ta.fill('测试工单提交接口');

  await page.getByRole('button', { name: '提交工单' }).click();
  await page.waitForTimeout(900);

  const notice2 = (await page.locator('.ly-ticket-notice').textContent().catch(() => ''))?.trim();
  const listText = await page.locator('.ly-ticket-list article').first().textContent().catch(() => '');
  const ticketPosts = events.filter((x) => x.startsWith('POST') && x.includes('/api/tickets')).length;

  const formData = await page.evaluate(() => {
    const form = document.querySelector('.ly-ticket-form');
    const data = new FormData(form);
    const obj = {};
    for (const [k, v] of data.entries()) obj[k] = v;
    return obj;
  });

  console.log(JSON.stringify({
    events,
    nSel,
    notice1,
    notice2,
    hasNoticeSubmitted: /已提交工单/.test(notice2 || ''),
    ticketPosts,
    listText: (listText || '').trim().slice(0, 180),
    formData
  }, null, 2));

  await browser.close();
})();
