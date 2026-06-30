import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];

page.on('request', req => {
  if (req.url().includes('/api/')) reqs.push({ method: req.method(), url: req.url(), body: req.postData() || '' });
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

await page.getByRole('button', { name: '转人工客服' }).first().click();
await page.waitForTimeout(1200);

const contBtn = page.locator('button', { hasText: '继续转人工' }).first();
console.log('continue_transfer_btn_exists', await contBtn.count());
if (await contBtn.count()) {
  const before = await page.locator('body').innerText();
  await contBtn.click();
  await page.waitForTimeout(1000);
  const after = await page.locator('body').innerText();
  console.log('text_changed', before !== after);
  console.log('contains_ticket', /工单|提交/.test(after));
  console.log('contains_notice', /正在为您转接|转人工客服工作时间|继续转人工/.test(after));
}

console.log('api_tail', reqs.slice(-10));
await browser.close();
