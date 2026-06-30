import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  await page.locator('textarea').first().fill('我想补传营业执照，在哪里操作？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(8000);

  const messageNodes = await page.$$eval('.ly-message', els => els.map(el => ({
    cls: el.className,
    texts: Array.from(el.querySelectorAll('button, p, div, span, strong')).map(x => x.textContent?.trim()).filter(Boolean).slice(0, 40)
  })));

  const sending = await page.locator('.ly-message assistant .ly-typing').count();

  console.log(JSON.stringify({ sending, messageNodes }, null, 2));
  await browser.close();
})();
