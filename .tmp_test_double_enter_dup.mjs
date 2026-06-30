import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const msgs = [];

page.on('request', req => {
  if (req.url().includes('/api/chat/message') && req.method() === 'POST') msgs.push(req.postData() || '');
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const input = page.locator('textarea').first();
await input.fill('按回车两次');
await input.press('Enter');
await input.press('Enter');
await page.waitForTimeout(2500);

console.log('request_count', msgs.length);
const parsed = msgs.map((s)=>{try{return JSON.parse(s).text}catch{ return s; }});
console.log('texts', parsed);

const allText = await page.locator('body').innerText();
console.log('echo_count', (allText.match(/按回车两次/g)||[]).length);

await browser.close();
