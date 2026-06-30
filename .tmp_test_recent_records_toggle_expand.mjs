import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const btn = page.getByRole('button', { name: '最近记录3' });
const snap = [];
for (let i = 0; i < 4; i++) {
  await btn.click();
  await page.waitForTimeout(500);
  const txt = await page.locator('body').innerText();
  snap.push({
    step: i,
    len: txt.length,
    hasQuick: /给我看一下后台数据/.test(txt),
    hasRecent: /最近记录/.test(txt),
    hasQuickGroup: /快捷提问/.test(txt),
    snippet: txt.slice(0, 220),
  });
}

console.log(JSON.stringify(snap, null, 2));
await browser.close();
