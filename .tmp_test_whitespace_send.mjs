import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const chatMsgs = [];

page.on('request', req => {
  if (req.url().includes('/api/chat/start')) chatMsgs.push({ type: 'start', body: req.postData() || ''});
  if (req.url().includes('/api/chat/message')) chatMsgs.push({ type: 'msg', body: req.postData() || ''});
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const input = page.locator('textarea').first();
await input.fill('   \n   ');
await page.waitForTimeout(200);
await page.getByRole('button', { name: '发送' }).click();
await page.waitForTimeout(1400);

console.log('req_count', chatMsgs.length);
console.log('entries', chatMsgs);

await browser.close();
