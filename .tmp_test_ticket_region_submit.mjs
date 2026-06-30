import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
let payload='';

page.on('request', req => {
  if (req.url().includes('/api/tickets') && req.method()==='POST') payload = req.postData()||'';
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: '提交新工单' }).click();
await page.waitForTimeout(500);

await page.locator('select').nth(1).selectOption({ index: 2 });
await page.locator('textarea').first().fill('区域提交测试');
await page.getByPlaceholder('请输入反馈人姓名').fill('区域测试');
await page.getByPlaceholder('请输入反馈人手机号').fill('13800999999');

await page.locator('select').nth(3).selectOption({ index: 1 }); // 上海市? maybe maybe
await page.locator('select').nth(4).selectOption({ index: 1 });
await page.locator('select').nth(5).selectOption({ index: 1 });

await page.locator('button', { hasText: '提交工单' }).first().click();
await page.waitForTimeout(1700);

console.log('payload', payload);

await browser.close();
