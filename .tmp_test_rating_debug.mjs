import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.locator('textarea').first().fill('给我看一下后台数据客服 · 1d');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(2000);

  const texts = await page.locator('button').allTextContents();
  const filtered = texts.map(t => t.trim()).filter(t => t.includes('评价') || t.includes('转人工')); 
  const buttons = await page.$$eval('button', (els) => els.filter(b => {
    const t=(b.textContent||'').trim();
    return t.includes('评价') || t.includes('转人工');
  }).map((b) => ({text:b.textContent.trim(), cls:b.className, outer:b.closest('.ly-message-stack')? 'inMessage': b.closest('.ly-composer')?'inComposer':'other'})));

  console.log('filteredTexts', filtered);
  console.log('buttons', buttons);
  await browser.close();
})();
