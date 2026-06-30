import { chromium } from 'playwright';
import fs from 'fs';

for (let i=1;i<=5;i++) fs.writeFileSync(`/tmp/tix${i}.txt`, `file-${i}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const uploadReqs = [];
const formReqs = [];

page.on('request', req => {
  const u = req.url();
  if (u.includes('/api/upload')) uploadReqs.push({ url:u, method:req.method(), postData:req.postData() || ''});
  if (u.includes('/api/tickets')) formReqs.push({ url:u, method:req.method(), postData:req.postData() || ''});
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);
await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: '提交新工单' }).click();
await page.waitForTimeout(700);

const fileInput = page.locator('input[type="file"]').first();
try {
  await fileInput.setInputFiles(['/tmp/tix1.txt','/tmp/tix2.txt','/tmp/tix3.txt','/tmp/tix4.txt','/tmp/tix5.txt']);
} catch (e) {
  console.log('setInputFiles_error', String(e.message));
}
await page.waitForTimeout(1200);

await page.locator('textarea').first().fill('测试上传上限');
await page.locator('select').nth(1).selectOption({ index: 1 });
await page.getByPlaceholder('请输入反馈人姓名').fill('李四');
await page.getByPlaceholder('请输入反馈人手机号').fill('13800001111');
await page.locator('button', { hasText: '提交工单' }).first().click();
await page.waitForTimeout(2500);

console.log('uploadReqs', uploadReqs);
console.log('ticketReqs', formReqs);
const body = await page.locator('body').innerText();
console.log('contains_success', /已提交工单/.test(body));
console.log('contains_upload_error', /最多|超|4/.test(body) || /附件数量/.test(body));

await browser.close();
