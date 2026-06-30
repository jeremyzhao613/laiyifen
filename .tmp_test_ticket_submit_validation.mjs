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

  await page.getByRole('button', { name: '工单反馈' }).click();
  await page.waitForTimeout(700);

  // Ensure on create view
  const createActive = await page.locator('.ly-ticket-switch button').first().getAttribute('class');

  await page.locator('button:has-text("提交工单")').click();
  await page.waitForTimeout(400);

  const note1 = await page.locator('.ly-ticket-notice').textContent().catch(() => '');

  // fill required fields minimally
  await page.locator('select').first().selectOption({ label: '菜单定位与操作引导' });
  await page.locator('textarea').fill('测试工单提交校验');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(1200);

  const notice2 = await page.locator('.ly-ticket-notice').textContent().catch(() => '');

  console.log(JSON.stringify({
    events,
    createActive: createActive || '',
    notice1: (note1 || '').trim(),
    notice2: (notice2 || '').trim(),
    ticketPosts: events.filter((x) => x.includes('/api/tickets') && x.startsWith('POST')).length
  }, null, 2));

  await browser.close();
})();
