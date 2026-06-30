import { chromium } from 'playwright';
import fs from 'fs';

fs.writeFileSync('/tmp/sample-upload3.txt', 'attach with text');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];

page.on('request', req => {
  const u = req.url();
  if (u.includes('/api/')) {
    reqs.push({
      method: req.method(),
      url: u,
      postData: req.postData() || '',
    });
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

await page.locator('input[type="file"]').first().setInputFiles('/tmp/sample-upload3.txt');
await page.waitForTimeout(500);
await page.getByRole('textbox').fill('请查看这个附件');
await page.waitForTimeout(200);

const sendBtn = page.getByRole('button', { name: '发送' }).first();
console.log('send_enabled', await sendBtn.isEnabled());
await sendBtn.click();
await page.waitForTimeout(3000);

const text = await page.locator('body').innerText();
console.log('contains_filename', /sample-upload3\.txt/.test(text));
console.log('contains_user_msg', /请查看这个附件/.test(text));
console.log('contains_reply', /小伊/.test(text));
console.log('requests', reqs);

await browser.close();
