import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const payloads = [];

page.on('request', (req) => {
  if (req.url().includes('/api/tickets') && req.method() === 'POST') {
    payloads.push(req.postData());
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);
await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(900);

await page.locator('select').nth(1).selectOption({ index: 2 });
await page.locator('textarea').first().fill('短号提交 payload 证据');
await page.getByPlaceholder('请输入反馈人姓名').fill('张三');
await page.getByPlaceholder('请输入反馈人手机号').fill('123');
await page.locator('button', { hasText: '提交工单' }).first().click();
await page.waitForTimeout(1600);

console.log('ticket_payload_count', payloads.length);
if (payloads.length) {
  console.log('payload', payloads);
}

await browser.close();
