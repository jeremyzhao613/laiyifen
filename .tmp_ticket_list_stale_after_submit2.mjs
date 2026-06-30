import { chromium } from 'playwright';

const ticketTitle = `UI-回归-${Date.now()}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(700);
await page.getByRole('button', { name: '提交新工单' }).click();
await page.waitForTimeout(500);

await page.locator('select').nth(1).selectOption({ index: 2 });
await page.locator('textarea').first().fill(ticketTitle);
await page.getByPlaceholder('请输入反馈人姓名').fill('测试新建');
await page.getByPlaceholder('请输入反馈人手机号').fill('13800001111');
await page.locator('button', { hasText: '提交工单' }).click();
await page.waitForTimeout(1500);

await page.getByRole('button', { name: '工单列表' }).click();
await page.waitForTimeout(900);
const lines = (await page.locator('body').innerText()).split('\n').map(s=>s.trim()).filter(Boolean);
console.log(lines.slice(0,120));

await browser.close();
