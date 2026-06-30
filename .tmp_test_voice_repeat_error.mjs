import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1100);

  const mic = page.locator('.ly-tool.muted').last();
  const initialMsgs = await page.locator('.ly-message').count().catch(() => 0);

  await mic.click();
  await page.waitForTimeout(500);
  await mic.click();
  await page.waitForTimeout(500);
  await mic.click();
  await page.waitForTimeout(800);

  const messages = await page.locator('.ly-message').allTextContents();
  const voiceHint = await page.locator('.ly-input-hint').textContent().catch(() => '');

  const countDenied = messages.filter((m) => m.includes('麦克风') || m.includes('语音输入暂时不可访问')).length;

  console.log(JSON.stringify({
    initialMsgs,
    afterMsgs: messages.length,
    countDenied,
    firstFew: messages.slice(-3),
    voiceHint: voiceHint?.trim()
  }, null, 2));

  await browser.close();
})();
