import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const res = [];
page.on('response', (r)=>{
  if (r.url().includes('/api/tickets')) res.push({status:r.status(),method:r.request().method(),url:r.url()});
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(1100);

await page.locator('select').nth(1).selectOption({ index: 2 });
await page.locator('textarea').first().fill('空手机号提交测试');
await page.getByPlaceholder('请输入反馈人姓名').fill('张三');
await page.getByPlaceholder('请输入反馈人手机号').fill('');

const before = await page.locator('body').innerText();
await page.locator('button', { hasText: '提交工单' }).first().click();
await page.waitForTimeout(1400);
const after = await page.locator('body').innerText();

console.log('has_success', /已提交工单/.test(after));
console.log('has_error', /请先填写|手机号|手机号/.test(after));
console.log('delta', after !== before);
console.log('api_calls', res);

await browser.close();
