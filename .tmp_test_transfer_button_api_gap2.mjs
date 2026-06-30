import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

const reqs=[];
page.on('request', req=>{ if(req.url().includes('/api/')) reqs.push({method:req.method(),url:req.url(),body:req.postData()||''}); });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout:120000 });
await page.waitForTimeout(1000);

const before = await page.locator('body').innerText();
await page.getByRole('button', { name: '转人工客服' }).first().click();
await page.waitForTimeout(1200);
const after = await page.locator('body').innerText();

console.log('diff_contains_after_button_word', after.includes('转人工客服'));
console.log('diff_contains_success', /已提交|处理中|工单|客服/.test(after));
console.log('diff_has_text', after.includes('正在为您转接人工') || after.includes('转接') || after.includes('联系')); 

// print nearby text around keyword
const idx = after.indexOf('转人工客服');
if (idx>=0) console.log('around', after.slice(Math.max(0,idx-80), idx+140));

console.log('reqs', reqs);

const diff = after.split('\n').filter(x=>!before.split('\n').includes(x));
console.log('new_lines_sample', diff.slice(0,10));

await browser.close();
