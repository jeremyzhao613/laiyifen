import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

const reqs = [];
page.on('request', req => {
  if (req.url().includes('/api/tickets') && req.method() === 'POST') {
    reqs.push({ url: req.url(), method: req.method(), body: req.postData() || '' });
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(900);

// 进入提交新工单面板
await page.getByRole('button', { name: '提交新工单' }).click();
await page.waitForTimeout(500);

// 仅选择问题类型和必填身份信息，故意不填问题描述
await page.locator('select').nth(1).selectOption({ index: 1 });
await page.getByPlaceholder('请输入反馈人姓名').fill('测试用户');
await page.getByPlaceholder('请输入反馈人手机号').fill('13800112222');

await page.getByRole('button', { name: '提交工单' }).first().click();
await page.waitForTimeout(1500);

const body = await page.locator('body').innerText();
console.log('request_count', reqs.length);
console.log('api_body', reqs);
console.log('contains_submit_success', /已提交工单/.test(body));
console.log('contains_validation', /请先填写|不能为空|问题描述|反馈|类型|手机号/.test(body));
console.log('body_preview', body.slice(0, 600));

await browser.close();
