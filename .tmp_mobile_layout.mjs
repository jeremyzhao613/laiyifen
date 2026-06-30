import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const events = [];
  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const btnTexts = await page.locator('button').allTextContents();
  const uniq = [...new Set(btnTexts.map(t => t.trim()).filter(Boolean))];

  const mobileBackExists = await page.locator('.ly-mobile-back').count();
  const visible = {
    mobile: uniq,
    mobileBackExists,
    navButtons: await page.locator('.ly-main-nav button').allTextContents().catch(() => [])
  };

  console.log(JSON.stringify(visible, null, 2));

  // click mobile back if present
  if (mobileBackExists) {
    const before = await page.locator('.ly-mobile-back span').textContent();
    await page.locator('.ly-mobile-back').click();
    await page.waitForTimeout(800);
    const after = await page.locator('.ly-mobile-back span').textContent().catch(() => '');
    const currentSectionText = await page.locator('.ly-pane-header strong').textContent().catch(() => '');
    console.log(JSON.stringify({ before: before?.trim(), after: after?.trim(), currentSectionText: currentSectionText?.trim(), events }, null, 2));
  }

  await browser.close();
})();
