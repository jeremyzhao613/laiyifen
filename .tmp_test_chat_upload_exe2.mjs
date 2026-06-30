import { chromium } from 'playwright';
import fs from 'fs';
fs.writeFileSync('/tmp/malicious2.exe', 'MZ_FAKE_EXECUTABLE');

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
await fileInput.setInputFiles('/tmp/malicious2.exe');
await page.waitForTimeout(600);

await page.getByRole('textbox').fill('请分析附件');
await page.waitForTimeout(200);

const sendBtn = page.locator('button[aria-label="发送"]').first();
console.log('send_enabled', await sendBtn.isEnabled());
await sendBtn.click();
await page.waitForTimeout(2200);

const msg = await page.locator('body').innerText();
console.log('upload_malicious', /malicious2\.exe/.test(msg));
console.log('has_text', /请分析附件/.test(msg));
console.log('has_reply', /小伊|回复|可以|请/.test(msg));

console.log('api_calls', reqs);
console.log('message_payloads', reqs.filter(r=>r.url.includes('/api/chat/message')).map(r=>r.body));

await browser.close();
