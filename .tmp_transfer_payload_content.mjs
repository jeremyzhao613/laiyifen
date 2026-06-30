import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const posts = [];

page.on('request', req => {
  if (req.url().includes('/api/tickets') && req.method() === 'POST') {
    posts.push(req.postData() || '');
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

await page.getByRole('textbox').fill('我在查询 2026-06 订单异常案例，麻烦帮我查一下。');
await page.waitForTimeout(200);
await page.getByRole('button', { name: '发送' }).click();
await page.waitForTimeout(1200);

await page.getByRole('button', { name: '转人工客服' }).first().click();
await page.waitForTimeout(1000);
await page.locator('button', { hasText: '继续转人工' }).first().click();
await page.waitForTimeout(1000);

console.log('ticket_posts', posts);
if (posts.length) {
  try {
    const p = JSON.parse(posts[0]);
    console.log('title', p.title);
    console.log('summary', p.summary);
  } catch (e) {
    console.log('parse_err', e.message);
  }
}

await browser.close();
