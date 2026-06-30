import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const startText = await page.locator('body').innerText();

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: '工单列表' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: '返回对话' }).click();
await page.waitForTimeout(1000);

const afterReturn = await page.locator('body').innerText();

await page.getByRole('button', { name: '转人工客服' }).click();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: '返回对话' }).click();
await page.waitForTimeout(1000);

const afterSecondReturn = await page.locator('body').innerText();

console.log('start_has_input', /请输入您的问题/.test(startText));
console.log('afterReturn_has_input', /请输入您的问题/.test(afterReturn));
console.log('afterReturn_has_ticket_feedback', /工单反馈/.test(afterReturn));
console.log('afterSecondReturn_has_input', /请输入您的问题/.test(afterSecondReturn));
console.log('afterSecondReturn_has_transfer_button', /转人工客服/.test(afterSecondReturn));

await browser.close();
