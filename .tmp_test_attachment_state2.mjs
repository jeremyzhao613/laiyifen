import { chromium } from 'playwright';
import fs from 'fs';

fs.writeFileSync('/tmp/sample-upload5.txt', 'state test2');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];
page.on('request', req => {
  if (req.url().includes('/api/')) {
    reqs.push({ method:req.method(), url:req.url(), postData:req.postData()||'' });
  }
});
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

await page.locator('input[type="file"]').first().setInputFiles('/tmp/sample-upload5.txt');
await page.waitForTimeout(500);
await page.getByRole('textbox').fill('附件测试');
await page.waitForTimeout(200);
await page.getByRole('button', { name: '发送' }).first().click();
await page.waitForTimeout(1800);

await page.getByRole('textbox').fill('第二条消息');
await page.waitForTimeout(200);
await page.getByRole('button', { name: '发送' }).first().click();
await page.waitForTimeout(1800);

console.log('requests', reqs);
const bodies = reqs.filter(r => r.url.includes('/api/chat/message')).map(r=>{
  try { return JSON.parse(r.postData); } catch { return r.postData; }
});
console.log('message_count', bodies.length);
console.log('second_message_has_files', bodies.length > 1 ? !!bodies[1].files : 'n/a');
console.log('second_message_files_len', bodies.length > 1 && Array.isArray(bodies[1].files) ? bodies[1].files.length : null);

await browser.close();
