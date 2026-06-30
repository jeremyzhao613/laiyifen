import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);
await page.getByRole('button', { name: '转人工客服' }).first().click();
await page.waitForTimeout(1200);

const body = await page.locator('body').innerText();
console.log('contains', /继续转人工/.test(body));

const elements = page.locator('button');
for (let i=0;i<await elements.count();i++) {
  const t = (await elements.nth(i).textContent())?.trim() || '';
  if (t.includes('转人工') || t.includes('提交') || /继续/.test(t)) {
    console.log(i,t,await elements.nth(i).getAttribute('class'));
  }
}

await browser.close();
