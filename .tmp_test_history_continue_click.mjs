import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];
page.on('request', req => { if (req.url().includes('/api/')) reqs.push(req.url()); });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);
await page.locator('button', { hasText: '查看全部历史' }).first().click();
await page.waitForTimeout(900);

const c1 = page.locator('text=继续处理').nth(0);
console.log('continue_text_count', await c1.count());
if (await c1.count()) {
  const before = await page.locator('body').innerText();
  const beforeUrl = page.url();
  await c1.click();
  await page.waitForTimeout(1200);
  const after = await page.locator('body').innerText();
  console.log('url_change', page.url() !== beforeUrl);
  console.log('text_change', before !== after);
  console.log('has_continue_prompt', /继续向小伊/.test(after));
  console.log('has_input_prompt', /请输入/.test(after));
}
console.log('requests', reqs);
await browser.close();
