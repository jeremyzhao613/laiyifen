import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const posts = [];

page.on('request', req => {
  if (req.url().includes('/api/tickets') && req.method()==='POST') {
    posts.push(req.postData() || '');
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

await page.getByRole('button', { name: '转人工客服' }).first().click();
await page.waitForTimeout(1200);

const btn = page.locator('button', { hasText: '继续转人工' }).first();
const countBefore = await btn.count();
if (!countBefore) {
  console.log('continue_missing', true);
  await browser.close();
  process.exit(0);
}

await btn.click();
await btn.click();
await page.waitForTimeout(1200);

console.log('ticket_posts', posts.length);
console.log(posts.slice(0,2));

if (posts.length) {
  try { console.log(JSON.parse(posts[0]).title); } catch {}
}

await browser.close();
