import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '工单反馈' }).click();
  await page.waitForTimeout(600);

  const tag = await page.locator('.ly-ticket-form').evaluate(el => el.tagName);
  const hasForm = await page.locator('form.ly-ticket-form').count();
  const outer = await page.locator('.ly-ticket-form').evaluate((el) => el.outerHTML.slice(0, 240));

  console.log(JSON.stringify({ tag, hasForm, outer }, null, 2));
  await browser.close();
})();
