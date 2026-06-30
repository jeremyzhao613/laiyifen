import { chromium } from 'playwright';
import fs from 'fs';

fs.writeFileSync('/tmp/malicious.exe', 'MZ_FAKE_EXECUTABLE');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];

page.on('request', req => {
  if (req.url().includes('/api/')) {
    reqs.push({ method: req.method(), url: req.url(), body: req.postData() || '' });
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const fileInput = page.locator('input[type="file"]').first();
await fileInput.setInputFiles('/tmp/malicious.exe');
await page.waitForTimeout(700);

const before = await page.locator('body').innerText();
const sendBtn = page.locator('button[aria-label="发送"]').first();
console.log('send_enabled', await sendBtn.isEnabled());
if (await sendBtn.isEnabled()) {
  await sendBtn.click();
  await page.waitForTimeout(1800);
}

const after = await page.locator('body').innerText();
const containsFile = /malicious\.exe/.test(after);
console.log('contains_filename_after', containsFile);
console.log('hasUploadErrorMsg', /不支持|格式|仅支持|上传失败/.test(after));

console.log('api_calls', reqs);
const uploadReq = reqs.filter(r=>r.url.includes('/api/upload'));
const chatReq = reqs.filter(r=>r.url.includes('/api/chat/message'));
console.log('upload_count', uploadReq.length);
console.log('chat_msg_count', chatReq.length);
if (chatReq[0]?.body) {
  console.log('chat_payload', chatReq[0].body.slice(0,400));
}

await browser.close();
