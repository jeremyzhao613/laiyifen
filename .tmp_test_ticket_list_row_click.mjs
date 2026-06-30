import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];
page.on('request', req => {
  const u=req.url();
  if (u.includes('/api/')) reqs.push({method:req.method(), url:u});
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: '工单列表' }).click();
await page.waitForTimeout(900);

const rows = page.locator('tr');
console.log('row_count', await rows.count());
let firstClickable = page.locator('tr').nth(1);
if (await firstClickable.count()) {
  const rowText = await firstClickable.innerText();
  const beforeUrl = page.url();
  const beforeDom = await page.locator('body').innerText();
  await firstClickable.click();
  await page.waitForTimeout(800);
  const afterUrl = page.url();
  const afterDom = await page.locator('body').innerText();
  console.log('row_text', rowText.slice(0,120));
  console.log('url_changed', beforeUrl !== afterUrl);
  console.log('dom_changed', beforeDom !== afterDom);
  console.log('api_tail', reqs.slice(-12));
  console.log('contains_detail_hint', /工单详情|会话|历史|当前|对话|消息|继续处理/.test(afterDom));
}

await browser.close();
