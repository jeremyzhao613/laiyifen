import { chromium } from 'playwright';
import fs from 'fs';
fs.writeFileSync('/tmp/sample-upload.txt', 'test-upload-payload');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];
page.on('request', req => {
  const u = req.url();
  if (u.includes('/api/upload')) reqs.push({method:req.method(), url:u});
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const fileInput = page.locator('input[type="file"]').first();
const before = await page.locator('body').innerText();
await fileInput.setInputFiles('/tmp/sample-upload.txt');
await page.waitForTimeout(1800);
const after = await page.locator('body').innerText();

console.log('before_snippet', before.slice(0,400));
console.log('after_snippet', after.slice(0,800));
console.log('api', reqs);

// quick diff tokens
const b = before.split('\n');
const a = after.split('\n');
const added = a.filter(x => x && !b.includes(x));
const removed = b.filter(x => x && !a.includes(x));
console.log('added', added);
console.log('removed', removed);

await browser.close();
