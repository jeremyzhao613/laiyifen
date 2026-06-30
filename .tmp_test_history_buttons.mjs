import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);
await page.locator('button', { hasText: '查看全部历史' }).first().click();
await page.waitForTimeout(1200);

const btns = page.getByRole('button');
const n = await btns.count();
const list = [];
for (let i=0;i<n;i++) {
  const t = (await btns.nth(i).textContent())?.trim() || '';
  const cls = await btns.nth(i).getAttribute('class');
  if (t) list.push({i,t,cls});
}
console.log('btn_count', n);
console.log('named_buttons', list);

// print body lines for quick read
const lines = (await page.locator('body').innerText()).split('\n').filter(Boolean);
console.log('lines', lines.slice(0,120));
await browser.close();
