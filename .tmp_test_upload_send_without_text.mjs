import { chromium } from 'playwright';
import fs from 'fs';

fs.writeFileSync('/tmp/sample-upload2.txt', 'attach-only payload test');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];

page.on('request', req => {
  const u = req.url();
  if (u.includes('/api/chat/') || u.includes('/api/upload')) {
    const postData = req.postData();
    reqs.push({
      method: req.method(),
      url: u,
      postData,
      contentType: req.headers()['content-type'],
    });
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const fileInput = page.locator('input[type="file"]').first();
await fileInput.setInputFiles('/tmp/sample-upload2.txt');
await page.waitForTimeout(900);

const sendBtn = page.getByRole('button', { name: '发送' }).first();
console.log('send_enabled', await sendBtn.isEnabled());
await sendBtn.click();
await page.waitForTimeout(2200);

const afterText = await page.locator('body').innerText();
console.log('contains_filename', /sample-upload2\.txt/.test(afterText));
console.log('contains_replies', /小伊|有什么可以帮您|回复/.test(afterText));
console.log('api_count', reqs.length);
console.log('api_entries', reqs);

await browser.close();
