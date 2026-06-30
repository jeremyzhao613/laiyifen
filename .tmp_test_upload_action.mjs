import { chromium } from 'playwright';
import fs from 'fs';

fs.writeFileSync('/tmp/sample-upload.txt', 'test-upload-payload');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];
page.on('request', req => {
  const u = req.url();
  if (u.includes('/api/') || u.includes('upload') || u.includes('files')) reqs.push({ method: req.method(), url: u });
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const fileInput = page.locator('input[type="file"]').first();
const before = await page.locator('body').innerText();

await fileInput.setInputFiles('/tmp/sample-upload.txt');
await page.waitForTimeout(1800);
const afterSet = await page.locator('body').innerText();

console.log('file_input_count', await page.locator('input[type="file"]').count());
console.log('body_changed_after_set', before !== afterSet);
console.log('api_after_set', reqs);

// now click upload button explicitly
await page.locator('button[aria-label="上传图片/文件"]').click();
await page.waitForTimeout(700);
console.log('api_after_click', reqs);
const afterClick = await page.locator('body').innerText();
console.log('body_changed_after_click', afterSet !== afterClick);

await browser.close();
