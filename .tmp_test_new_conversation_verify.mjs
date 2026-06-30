import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.locator('textarea').first().fill('我这边还有哪些待办没处理？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(900);

  await page.locator('input[type="file"]').setInputFiles('/Users/jeremy/Documents/dify/package.json');
  await page.waitForTimeout(800);

  await page.locator('.ly-transfer').click();
  await page.locator('.ly-service-popover button').click();
  await page.waitForTimeout(800);

  await page.getByRole('button', { name: '新建对话' }).click();
  await page.waitForTimeout(700);

  const allText = await page.locator('.ly-message').allTextContents();
  const welcomeTextVisible = await page.getByText('你好，我是小伊!有什么可以帮您的?').isVisible().catch(() => false);
  const allVisibleText = await page.locator('body').innerText();
  const messageCount = await page.locator('.ly-message').count();

  console.log(JSON.stringify({
    messageCount,
    allText,
    welcomeTextVisible,
    hasWelcomeInBody: allVisibleText.includes('你好，我是小伊')
  }, null, 2));

  await browser.close();
})();
