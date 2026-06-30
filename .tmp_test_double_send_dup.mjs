import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const sends = [];

page.on('request', req => {
  if (req.url().includes('/api/chat/message') && req.method() === 'POST') sends.push(req.postData() || '');
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

await page.getByRole('textbox').fill('重复提交测试');
await page.getByRole('button', { name: '发送' }).click();
await page.getByRole('button', { name: '发送' }).click();
await page.waitForTimeout(1800);

console.log('send_count', sends.length);
if (sends.length) {
  const parsed = sends.map(s => {
    try { return JSON.parse(s).text; } catch(e){ return s; }
  });
  console.log('messages', parsed);
}

const text = await page.locator('body').innerText();
const occurrences = (text.match(/重复提交测试/g) || []).length;
console.log('message_echo_count', occurrences);

await browser.close();
