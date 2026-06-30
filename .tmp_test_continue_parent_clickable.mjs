import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);
await page.locator('button', { hasText: '查看全部历史' }).first().click();
await page.waitForTimeout(900);

const target = page.locator('text=继续处理').first();
const anc = await target.evaluate((node) => {
  const chain=[];
  let cur = node.parentElement;
  for (let i=0;i<5 && cur;i++) {
    chain.push({tag: cur.tagName, cls: cur.className, role: cur.getAttribute('role'), id: cur.id, onclick: !!cur.onclick});
    cur = cur.parentElement;
  }
  return chain;
});
console.log(anc);

await browser.close();
