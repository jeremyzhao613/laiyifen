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
  await page.waitForTimeout(700);

  const searchInput = page.locator('input[placeholder="搜索标题、内容、工单号或客服"]').first();
  await searchInput.fill('不存在的关键字xyz');
  await page.waitForTimeout(500);

  const emptyText = await page.locator('.ly-history-detail-empty strong').textContent().catch(() => '');
  const matchCount = await page.locator('.ly-history-result-bar span').textContent().catch(() => '');

  const searchInput2 = page.locator('input[placeholder="搜索标题、内容、工单号或客服"]').first();
  await searchInput2.fill('给我看一下后台数据');
  await page.waitForTimeout(700);

  const matchCount2 = await page.locator('.ly-history-result-bar span').textContent().catch(() => '');

  console.log(JSON.stringify({
    events,
    emptyText: emptyText?.trim(),
    matchCount: matchCount?.trim(),
    matchCount2: matchCount2?.trim()
  }, null, 2));

  await browser.close();
})();
