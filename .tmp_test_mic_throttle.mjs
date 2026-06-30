import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1100);

  const mic = page.locator('.ly-tool.muted[aria-label="语音输入"]');
  for (let i = 0; i < 5; i++) {
    await mic.click();
    await page.waitForTimeout(80);
  }

  await page.waitForTimeout(1000);

  const messages = await page.locator('.ly-message').allTextContents();
  const deniedCnt = messages.filter((m) => m.includes('当前环境暂时无法访问麦克风') || m.includes('麦克风权限')).length;

  const apiMsgs = messages;
  const hint = await page.locator('.ly-input-hint').textContent().catch(() => '');

  console.log(JSON.stringify({
    totalMsgs: messages.length,
    deniedCnt,
    messageTail: messages.slice(-6),
    hint: hint?.trim()
  }, null, 2));

  await browser.close();
})();
