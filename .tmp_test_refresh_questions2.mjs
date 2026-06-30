import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const quickBtn = page.locator('button').filter({ hasText: '换一换' });
const quickItems = page.locator('button').filter({ hasText: /客服 · 1d/ });
let before = [];
for (let i = 0; i < 6; i++) if (await quickItems.nth(i).count()) before.push((await quickItems.nth(i).textContent())?.trim() || '');

for (let i = 0; i < 3; i++) {
  await quickBtn.first().click();
  await page.waitForTimeout(700);
}

let after = [];
for (let i = 0; i < 6; i++) if (await quickItems.nth(i).count()) after.push((await quickItems.nth(i).textContent())?.trim() || '');

const allSame = JSON.stringify(before) === JSON.stringify(after);
console.log('before', before);
console.log('after', after);
console.log('same_after_3_clicks', allSame);

await browser.close();
