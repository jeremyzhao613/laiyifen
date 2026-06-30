import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const sends = [];

page.on('request', req => {
  if (req.url().includes('/api/chat/message') && req.method() === 'POST') {
    sends.push(req.postData() || '');
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const input = page.locator('textarea').first();
await input.fill('');
await input.type('第一行');
await input.press('Shift+Enter');
await input.type('第二行');
await page.waitForTimeout(300);

const bodyAfterShift = await page.locator('body').innerText();
console.log('contains_second_line', /第一行/.test(bodyAfterShift) && /第二行/.test(bodyAfterShift));
console.log('send_count_after_shift', sends.length);

await input.press('Enter');
await page.waitForTimeout(1500);
console.log('send_count_after_enter', sends.length);
if (sends.length) {
  try { console.log('last_payload_text', JSON.parse(sends[sends.length-1]).text); } catch (e) { console.log('payload_raw', sends[sends.length-1]); }
}

await browser.close();
