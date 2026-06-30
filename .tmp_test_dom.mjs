import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await page.locator('textarea').first().fill('供应商资料提交后多久能审核完？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(2500);

  const buttons = await page.locator('.ly-message').locator('button').allTextContents();
  const allButtons = await page.locator('button').allTextContents();
  const actionButtonTexts = await page.locator('.ly-message-badge, .ly-message-title, .ly-message-actions, .ly-action-buttons').allTextContents();

  console.log('allButtonsCount', allButtons.length);
  console.log('messagesButtonTextsSample', buttons);
  console.log('actionAreaTexts', actionButtonTexts);
  console.log('allButtons', allButtons);

  await browser.close();
})();
