import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const events = [];
  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '历史对话' }).click();
  await page.waitForTimeout(700);

  const labels = [
    '0进行中',
    '0AI 对话',
    '3客服对话',
    'AI 对话',
    '客服对话',
    '全部'
  ];

  const summary = {};

  const byText = async (text) => {
    return page.locator('.ly-history-filter button, .status-card').filter({ hasText: text }).first();
  };

  for (const lab of labels) {
    const btn = await byText(lab);
    const count = await btn.count();
    if (count === 0) continue;
    await btn.click();
    await page.waitForTimeout(250);
    const resultText = (await page.locator('.ly-history-result-bar span').textContent().catch(() => ''))?.trim();
    summary[lab] = resultText;
  }

  console.log(JSON.stringify({
    events,
    summary,
    activeFilters: await page.locator('.ly-history-filter button.active').allTextContents().catch(() => [])
  }, null, 2));

  await browser.close();
})();
