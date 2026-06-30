import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const payloads = [];

page.on('request', req => {
  if (req.url().includes('/api/tickets') && req.method() === 'POST') payloads.push(req.postData() || '');
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

await page.locator('select').first().selectOption('加盟商');
await page.waitForTimeout(200);
await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(900);

await page.locator('select').nth(1).selectOption({ index: 2 });
await page.locator('textarea').first().fill('身份联动测试');
await page.getByPlaceholder('请输入反馈人姓名').fill('赵六');
await page.getByPlaceholder('请输入反馈人手机号').fill('13800112233');
await page.locator('button', { hasText: '提交工单' }).first().click();
await page.waitForTimeout(1500);

console.log('payload_count', payloads.length);
console.log('payload', payloads[0]);

await browser.close();
