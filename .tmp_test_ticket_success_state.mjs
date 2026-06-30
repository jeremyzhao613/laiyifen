import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const posts = [];

page.on('request', req => {
  if (req.url().includes('/api/tickets')) posts.push({url:req.url(),method:req.method(),body:req.postData()||''});
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: '提交新工单' }).click();
await page.waitForTimeout(500);

await page.locator('select').nth(1).selectOption({ index: 2 });
await page.locator('textarea').first().fill('防抖验证');
await page.getByPlaceholder('请输入反馈人姓名').fill('测试重复');
await page.getByPlaceholder('请输入反馈人手机号').fill('13800000000');

await page.locator('button', { hasText: '提交工单' }).first().click();
await page.waitForTimeout(1700);

const summaryAfterSubmit = {
  textarea: await page.locator('textarea').first().inputValue(),
  name: await page.getByPlaceholder('请输入反馈人姓名').inputValue(),
  phone: await page.getByPlaceholder('请输入反馈人手机号').inputValue(),
  hasSubmit: await page.locator('button', { hasText: '提交工单' }).count(),
  hasSuccessNotice: /已提交工单/.test(await page.locator('body').innerText()),
  hasFeedbackText: /防抖验证/.test(await page.locator('body').innerText()),
};

// try submit second time immediately
await page.locator('button', { hasText: '提交工单' }).first().click();
await page.waitForTimeout(1600);

console.log('post_count', posts.length);
console.log('summaryAfterSubmit', summaryAfterSubmit);
console.log('bodyAfter', await page.locator('body').innerText().then(t=>t.slice(0,400)));
console.log('requests', posts);

await browser.close();
