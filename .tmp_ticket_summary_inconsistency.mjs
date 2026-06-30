import { chromium } from 'playwright';

const ticketSummary = `字段回写-${Date.now()}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
let payload = null;

page.on('request', req => {
  if (req.url().includes('/api/tickets') && req.method()==='POST') {
    payload = req.postData() || '';
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: '提交新工单' }).click();
await page.waitForTimeout(500);

await page.locator('select').nth(1).selectOption({ index: 2 });
await page.locator('textarea').first().fill(ticketSummary);
await page.getByPlaceholder('请输入反馈人姓名').fill('赵六');
await page.getByPlaceholder('请输入反馈人手机号').fill('15555550000');
await page.getByPlaceholder('请输入门店编码').fill('S-001');
await page.getByPlaceholder('请输入昵称').fill('赵小六');
await page.getByPlaceholder('请输入公司名称').fill('测试公司A');
await page.getByPlaceholder('请输入SAP编码').fill('SAP-888');

await page.locator('button', { hasText: '提交工单' }).first().click();
await page.waitForTimeout(1700);

console.log('payload_raw', payload);

const lines = (await page.locator('body').innerText()).split('\n').map(s=>s.trim()).filter(Boolean);
const summaryLine = lines.find(s => s.includes(ticketSummary));
console.log('summaryLine', summaryLine);

await browser.close();
