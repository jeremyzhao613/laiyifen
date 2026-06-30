import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

await page.getByRole('button', { name: '工单反馈' }).click().catch(()=>{});
await page.waitForTimeout(1200);

const buttons = page.locator('button');
for (let i=0;i<await buttons.count();i++) {
  const txt = (await buttons.nth(i).textContent())?.trim() || '';
  if (txt) console.log(i, JSON.stringify(txt), 'disabled=', await buttons.nth(i).isDisabled(), 'class=', await buttons.nth(i).getAttribute('class'));
}

await page.close();
await browser.close();
