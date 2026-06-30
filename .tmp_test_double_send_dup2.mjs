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
await page.waitForTimeout(1200);

const input = page.locator('textarea').first();
await input.fill('重复提交测试');
await page.waitForTimeout(300);

const sendBtn = page.locator('button.ly-send').first();
console.log('send_enabled_after_fill', await sendBtn.isEnabled());
if (await sendBtn.isEnabled()) {
  await sendBtn.click();
  await sendBtn.click();
  await page.waitForTimeout(1200);
}

console.log('send_count', sends.length);
const parsed = sends.map((s) => {
  try { return JSON.parse(s).text; } catch { return s; }
});
console.log('texts', parsed);
const text = await page.locator('body').innerText();
console.log('echo_count', (text.match(/重复提交测试/g) || []).length);

await browser.close();
