import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: '工单列表' }).click();
await page.waitForTimeout(1200);

const text = await page.locator('body').innerText();
console.log(text.slice(0,3000));

const cards = page.locator('[class*="ticket"], [class*="list"], [class*="card"], .item, .row');
console.log('card_count', await cards.count());

const buttons = page.locator('button');
for (let i=0;i<await buttons.count();i++) {
  const txt = (await buttons.nth(i).textContent())?.trim() || '';
  if (txt && /返回|提交|重置|下载|详情|查看|筛选|历史/.test(txt) && i<80) {
    console.log('btn', i, txt, await buttons.nth(i).getAttribute('class'));
  }
}

await browser.close();
