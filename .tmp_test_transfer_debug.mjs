import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.locator('textarea').first().fill('给我看一下后台数据客服 · 1d');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(2500);

  const list = await page.$$eval('button', (els) =>
    els
      .map((b, index) => {
        const p = b.parentElement;
        return {
          index,
          text: (b.textContent || '').trim(),
          cls: b.className,
          outerHTML: b.outerHTML.slice(0, 180),
          parentClass: p?.className || '',
          grandClass: p?.parentElement?.className || '',
          ancestors: (function walk(el) {
            const names = [];
            let cur = el;
            while (cur && cur !== document.body && cur.parentElement) {
              cur = cur.parentElement;
              names.push(cur.className || cur.tagName.toLowerCase());
            }
            return names.slice(0, 5);
          })(b)
        };
      })
      .filter(x => x.text.includes('转人工客服'))
  );

  console.log(JSON.stringify(list, null, 2));
  await browser.close();
})();
