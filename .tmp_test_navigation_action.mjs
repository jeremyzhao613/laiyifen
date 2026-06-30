import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];
  const popupUrls = [];

  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });
  page.on('popup', async popup => { popupUrls.push(popup.url()); await popup.close().catch(() => {}); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  await page.locator('textarea').first().fill('我想补传营业执照，在哪里操作？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(5000);

  const actionButtons = await page.$$eval('.ly-message', (els) =>
    els.flatMap((el) =>
      Array.from(el.querySelectorAll('button')).map((b) => ({
        text: (b.textContent || '').trim(),
        cls: b.className,
        html: b.outerHTML.slice(0, 160)
      }))
    ).filter((x) => x.text.includes('打开') || x.text.includes('生成') || x.text.includes('转人工') || x.text.includes('客服'))
  );

  const countAllActionButtons = await page.locator('.ly-message-actions button').count();
  console.log('actionButtons', actionButtons);

  let clicked = false;
  const openBtn = page.getByRole('button', { name: '打开个人中心' });
  if ((await openBtn.count()) > 0) {
    await openBtn.click();
    clicked = true;
  }

  await page.waitForTimeout(600);

  console.log(JSON.stringify({ events, popupCount: popupUrls.length, popupUrls, clicked, countAllActionButtons }, null, 2));

  await browser.close();
})();
