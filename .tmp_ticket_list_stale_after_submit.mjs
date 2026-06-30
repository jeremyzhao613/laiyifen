import { chromium } from 'playwright';

const ticketTitle = `UI-回归-${Date.now()}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];
page.on('request', req => {
  if (req.url().includes('/api/')) reqs.push({ method: req.method(), url: req.url() });
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(900);

await page.getByRole('button', { name: '工单列表' }).click();
await page.waitForTimeout(900);
const listTextBefore = await page.locator('body').innerText();
const beforeHas = listTextBefore.includes(ticketTitle);

await page.getByRole('button', { name: '提交新工单' }).click();
await page.waitForTimeout(500);
await page.locator('select').nth(1).selectOption({ index: 2 });
await page.locator('textarea').first().fill(ticketTitle);
await page.getByPlaceholder('请输入反馈人姓名').fill('测试新建');
await page.getByPlaceholder('请输入反馈人手机号').fill('13800001111');
await page.locator('button', { hasText: '提交工单' }).first().click();
await page.waitForTimeout(1400);

await page.getByRole('button', { name: '工单列表' }).click();
await page.waitForTimeout(900);
const listTextAfter = await page.locator('body').innerText();

console.log('title_in_before', beforeHas);
console.log('title_in_after', listTextAfter.includes(ticketTitle));
console.log('api_calls', reqs);
console.log('body_after_has_success_word', /已提交工单/.test(listTextAfter));

await browser.close();
