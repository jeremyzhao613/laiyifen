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

const cont = page.locator('text=继续转人工');
console.log('count', await cont.count());
if (await cont.count()) {
  await cont.click();
  await page.waitForTimeout(300);
  await cont.click();
  await page.waitForTimeout(1200);
}

console.log('posts', posts);
console.log('post_count', posts.length);
if (posts.length) {
  const parsed = posts.map((p)=>{ try { return JSON.parse(p).title; } catch { return ''; } });
  console.log('titles', parsed);
}

await browser.close();
