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
const fb = page.locator('textarea[placeholder="请输入意见反馈"]');
await fb.fill('防抖验证');
await page.getByPlaceholder('请输入反馈人姓名').fill('测试重复');
await page.getByPlaceholder('请输入反馈人手机号').fill('13800000000');

const submitBtn = page.locator('button', { hasText: '提交工单' }).first();
console.log('submit_enabled_before', await submitBtn.isEnabled());
await submitBtn.click();
await page.waitForTimeout(1500);

const success = /已提交工单/.test(await page.locator('body').innerText());
console.log('success', success);
console.log('textarea_exists_after', await page.locator('textarea').count());
console.log('submit_exists_after', await submitBtn.count());
console.log('ticket_post_count_after_first', posts.length);

if (success) {
  // try clicking submit again if button still exists
  if (await submitBtn.isEnabled()) {
    await submitBtn.click();
    await page.waitForTimeout(1200);
  }
}

console.log('ticket_post_count_total', posts.length);
console.log('requests', posts);

await browser.close();
