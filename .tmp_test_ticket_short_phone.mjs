import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const ticket = [];
page.on('response', (r)=>{ if (r.url().includes('/api/tickets')) ticket.push({status:r.status(),statusText:r.statusText(),method:r.request().method()}); });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);
await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(900);

await page.locator('select').nth(1).selectOption({ index: 2 });
await page.locator('textarea').first().fill('短号测试');
await page.getByPlaceholder('请输入反馈人姓名').fill('李四');
await page.getByPlaceholder('请输入反馈人手机号').fill('123');
await page.locator('button', { hasText: '提交工单' }).first().click();
await page.waitForTimeout(1500);

const body = await page.locator('body').innerText();
console.log('ok_msg', /已提交工单/.test(body));
console.log('ticket_calls', ticket);

await browser.close();
