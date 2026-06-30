import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const reqs = [];
page.on('request', req => { if (req.url().includes('/api/')) reqs.push({ method:req.method(), url:req.url() }); });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);
await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: '工单列表' }).click();
await page.waitForTimeout(1200);

const cards = page.locator('text=ZD-20260629').locator('..');
console.log('cards_count', await cards.count());
if (await cards.count()) {
  const c = cards.first();
  const before = await page.locator('body').innerText();
  const beforeUrl = page.url();
  await c.click({ force: true }).catch((e)=>{ console.log('click_err', String(e.message)); });
  await page.waitForTimeout(900);
  const after = await page.locator('body').innerText();
  console.log('url_changed', beforeUrl !== page.url());
  console.log('dom_changed', before !== after);
  console.log('contains_chat_content', /工单 ZD-20260629|当前查看|继续处理/.test(after));
}

console.log('reqs', reqs.slice(-12));
await browser.close();
