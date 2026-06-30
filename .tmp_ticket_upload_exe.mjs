import { chromium } from 'playwright';
import fs from 'fs';
fs.writeFileSync('/tmp/tix_exec.exe', 'EXE_BINARY');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const reqs = [];
page.on('request', req => {
  const u = req.url();
  if (u.includes('/api/')) reqs.push({ method: req.method(), url: u, body: req.postData() || '' });
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: '提交新工单' }).click();
await page.waitForTimeout(500);

await page.locator('input[type="file"]').first().setInputFiles('/tmp/tix_exec.exe');
await page.waitForTimeout(700);
await page.locator('select').nth(1).selectOption({ index: 1 });
await page.locator('textarea').first().fill('工单上传exe测试');
await page.getByPlaceholder('请输入反馈人姓名').fill('王五');
await page.getByPlaceholder('请输入反馈人手机号').fill('13800112233');
await page.locator('button', { hasText: '提交工单' }).click();
await page.waitForTimeout(1800);

const body = await page.locator('body').innerText();
console.log('contains_success', /已提交工单/.test(body));
console.log('contains_upload_error', /格式|不支持|失败/.test(body));
console.log('api', reqs);

await browser.close();
