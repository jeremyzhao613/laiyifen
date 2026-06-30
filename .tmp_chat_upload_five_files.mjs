import { chromium } from 'playwright';
import fs from 'fs';

for (let i=1;i<=5;i++) fs.writeFileSync(`/tmp/cf${i}.txt`, `chat-upload-${i}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
let messageBody = '';

page.on('request', req => {
  if (req.url().includes('/api/chat/message') && req.method()==='POST') {
    messageBody = req.postData() || '';
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

const fileInput = page.locator('input[type="file"]').first();
await fileInput.setInputFiles(['/tmp/cf1.txt','/tmp/cf2.txt','/tmp/cf3.txt','/tmp/cf4.txt','/tmp/cf5.txt']);
await page.waitForTimeout(700);

const bodyAfterUpload = await page.locator('body').innerText();
await page.getByRole('textbox').fill('测试五个附件');
await page.waitForTimeout(200);
await page.getByRole('button', { name: '发送' }).click();
await page.waitForTimeout(2500);

console.log('contains_all_5', /cf1\.txt/.test(bodyAfterUpload) && /cf2\.txt/.test(bodyAfterUpload) && /cf3\.txt/.test(bodyAfterUpload) && /cf4\.txt/.test(bodyAfterUpload) && /cf5\.txt/.test(bodyAfterUpload));
console.log('visible_file_count', (bodyAfterUpload.match(/cf\d\.txt/g) || []).length);

try {
  const parsed = JSON.parse(messageBody);
  const files = parsed.files || [];
  console.log('files_in_payload', files.length);
  console.log('file_names_in_payload', files.map(f=>f.originalName));
} catch (e) {
  console.log('parse_error', String(e.message));
  console.log('payload', messageBody.slice(0,500));
}

const uiBody = await page.locator('body').innerText();
console.log('ui_has_upload_limit_tip', /最多 4 个附件/.test(uiBody));
console.log('ui_has_error', /超出|最多|失败|不支持/.test(uiBody));

await browser.close();
