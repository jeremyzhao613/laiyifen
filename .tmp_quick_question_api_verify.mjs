import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
const page = await context.newPage();
const reqs = [];

page.on('requestfinished', req => {
  const u = req.url();
  if (u.includes('/api/chat/') || u.includes('/api/bootstrap')) {
    reqs.push({ method: req.method(), url: u, body: req.postData() || '' });
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1300);

const bq = page.locator('button', { hasText: /我这边还有哪些待办没处理？/ }).first();
await bq.click();
await page.waitForTimeout(2500);

const body = await page.locator('body').innerText();
console.log('text_has_query', /我这边还有哪些待办没处理？/.test(body));
console.log('text_has_reply', /没有|目前|是|建议|可以|帮|请/.test(body));
console.log('requests', reqs);

await browser.close();
