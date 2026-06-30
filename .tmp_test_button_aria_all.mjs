import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const buttons = page.locator('button');
const n = await buttons.count();
for (let i=0;i<n;i++) {
  const btn = buttons.nth(i);
  const aria = await btn.getAttribute('aria-label');
  if (aria) {
    console.log(i, 'aria=', aria, 'text=', (await btn.textContent())?.trim(), 'class=', await btn.getAttribute('class'));
  }
}

await browser.close();
