import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '历史对话' }).click();
  await page.waitForTimeout(700);

  const initialActiveText = await page.locator('.ly-history-overview .status-card strong').textContent().catch(() => '');
  const statusCardLabel = await page.locator('.ly-history-overview .status-card').textContent().catch(() => '');
  const beforeResult = await page.locator('.ly-history-result-bar span').textContent().catch(() => '');
  const beforeFilterActive = await page.locator('.ly-history-filter .active').allTextContents().catch(() => []);

  await page.locator('.ly-history-overview .status-card').click();
  await page.waitForTimeout(350);

  const afterResult = await page.locator('.ly-history-result-bar span').textContent().catch(() => '');
  const afterFilterActive = await page.locator('.ly-history-filter .active').allTextContents().catch(() => []);
  const selectedResultCount = (afterResult || '').match(/\d+/)?.[0] || '';

  console.log(JSON.stringify({
    initialActiveText: initialActiveText?.trim(),
    statusCardLabel: statusCardLabel?.trim(),
    beforeResult: beforeResult?.trim(),
    afterResult: afterResult?.trim(),
    beforeFilterActive,
    afterFilterActive,
    selectedResultCount
  }, null, 2));

  await browser.close();
})();
