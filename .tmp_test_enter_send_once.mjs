import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];

page.on('requestfinished', req => {
  const u = req.url();
  if (u.includes('/api/chat/')) reqs.push({ method: req.method(), url: u });
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const textbox = page.getByRole('textbox').first();
await textbox.fill('你是谁');
await page.waitForTimeout(200);

// press Enter
await textbox.press('Enter');
await page.waitForTimeout(2500);

const afterText = await page.locator('body').innerText();

console.log('contains_user_msg', /你是谁/.test(afterText));
console.log('chat_api_count', reqs.length);
console.log('requests', reqs);

await browser.close();
