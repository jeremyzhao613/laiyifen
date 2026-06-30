import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(2000);

const text = await page.innerText('body');
console.log('TEXT_SNIPPET', text.slice(0,3000));

const roleButtons = page.getByRole('button');
const roleCount = await roleButtons.count();
console.log('ROLE_BUTTON_COUNT', roleCount);
for (let i = 0; i < Math.min(roleCount, 80); i++) {
  const txt = (await roleButtons.nth(i).textContent())?.trim() || '';
  const enabled = await roleButtons.nth(i).isEnabled();
  const tag = await roleButtons.nth(i).evaluate((el)=>el.tagName);
  const cls = await roleButtons.nth(i).getAttribute('class');
  console.log('RB', i, tag, enabled, txt, 'class=', cls?.slice(0,120));
}

const anchors = page.locator('a');
console.log('A_COUNT', await anchors.count());

await page.close();
await browser.close();
