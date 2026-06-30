import { chromium } from 'playwright';
import fs from 'fs';

for (let i=1;i<=5;i++) fs.writeFileSync(`/tmp/tix${i}_u.txt`, `file-${i}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);
await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: '提交新工单' }).click();
await page.waitForTimeout(500);

const fileInput = page.locator('input[type="file"]').first();
await fileInput.setInputFiles(['/tmp/tix1_u.txt','/tmp/tix2_u.txt','/tmp/tix3_u.txt','/tmp/tix4_u.txt','/tmp/tix5_u.txt']);
await page.waitForTimeout(900);

const bodyAfterUpload = await page.locator('body').innerText();
const showCount = (bodyAfterUpload.match(/tix\d_u\.txt/g) || []).length;
const has4 = /tix4_u\.txt/.test(bodyAfterUpload);
const has5 = /tix5_u\.txt/.test(bodyAfterUpload);

console.log('after_upload_contains_names', { tix1: /tix1_u\.txt/.test(bodyAfterUpload), tix2: /tix2_u\.txt/.test(bodyAfterUpload), tix3: /tix3_u\.txt/.test(bodyAfterUpload), tix4: has4, tix5: has5, totalMatched: showCount });

await page.locator('textarea').first().fill('测试上限文件名展示');
await page.locator('select').nth(1).selectOption({ index: 1 });
await page.getByPlaceholder('请输入反馈人姓名').fill('王五');
await page.getByPlaceholder('请输入反馈人手机号').fill('13800138000');
await page.locator('button', { hasText: '提交工单' }).first().click();
await page.waitForTimeout(1700);

const submitted = await page.locator('body').innerText();
console.log('submitted_contains_tix5', /tix5_u\.txt/.test(submitted));
console.log('success', /已提交工单/.test(submitted));

await browser.close();
