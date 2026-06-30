import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const q1 = await page.locator('.ly-question-grid button span').allTextContents();

  await page.selectOption('select', { label: '加盟商' });
  await page.waitForTimeout(600);
  const q2 = await page.locator('.ly-question-grid button span').allTextContents();

  await page.selectOption('select', { label: '经销商' });
  await page.waitForTimeout(600);
  const q3 = await page.locator('.ly-question-grid button span').allTextContents();

  console.log(JSON.stringify({
    q1, q2, q3,
    same12: JSON.stringify(q1) === JSON.stringify(q2),
    same23: JSON.stringify(q2) === JSON.stringify(q3)
  }, null, 2));

  await browser.close();
})();
