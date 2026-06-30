import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const apiReqs = [];
page.on('response', (resp) => {
  const url = resp.url();
  if (url.includes('/api/')) apiReqs.push({ status: resp.status(), url });
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(800);

const quickBtn = page.locator('button').filter({ hasText: /^换一换$/ });
await quickBtn.first().click();
await page.waitForTimeout(1200);

const quickItemsSel = page.locator('button').filter({ hasText: /客服/ });
const items = (await quickItemsSel.allTextContents()).map((s) => s.trim()).filter(Boolean);

console.log('items_after_click', items);
console.log('apiReqs', apiReqs);
await browser.close();
