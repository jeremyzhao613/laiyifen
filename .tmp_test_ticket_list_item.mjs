import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];

  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: '工单反馈' }).click();
  await page.waitForTimeout(700);

  await page.locator('.ly-ticket-switch button').filter({ hasText: '工单列表' }).click();
  await page.waitForTimeout(600);

  const firstTitle = await page.locator('.ly-ticket-list article strong').nth(0).textContent();
  const beforeArticleCount = await page.locator('.ly-ticket-list article').count();
  const beforeBody = await page.locator('.ly-main').textContent().catch(() => '');
  await page.locator('.ly-ticket-list article').first().click();
  await page.waitForTimeout(1000);

  const afterArticleCount = await page.locator('.ly-ticket-list article').count();
  const afterBody = await page.locator('.ly-main').textContent().catch(() => '');

  console.log(JSON.stringify({
    events,
    beforeArticleCount,
    afterArticleCount,
    firstTitle: firstTitle?.trim(),
    beforeBody: beforeBody.includes('TK-') || beforeBody.includes('给我看一下后台数据'),
    afterBody: afterBody.includes('TK-') || afterBody.includes('给我看一下后台数据')
  }, null, 2));

  await browser.close();
})();
