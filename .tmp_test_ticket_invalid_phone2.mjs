import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const ticketResp = [];

page.on('response', (resp) => {
  if (resp.url().includes('/api/tickets')) {
    ticketResp.push({ status: resp.status(), url: resp.url(), method: resp.request().method() });
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(1200);

const typeSelect = page.locator('select').nth(1);
await typeSelect.selectOption({ index: 2 });

await page.locator('textarea').first().fill('这是一条无效手机号测试');
await page.getByPlaceholder('请输入反馈人姓名').fill('自动化测试');
await page.getByPlaceholder('请输入反馈人手机号').fill('abcd1234');

const before = await page.locator('body').innerText();
await page.locator('button', { hasText: '提交工单' }).first().click();
await page.waitForTimeout(1200);
const after = await page.locator('body').innerText();

console.log('submitted', /已提交工单/.test(after));
console.log('error_notice', /手机号|格式|请/.test(after));
console.log('body_delta', after !== before);
console.log('ticketResp', ticketResp);

await browser.close();
