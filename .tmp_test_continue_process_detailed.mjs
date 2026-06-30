import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];
page.on('request', req => {
  const u = req.url();
  if (u.includes('/api/')) reqs.push({method:req.method(), url:u});
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(800);

await page.locator('button', { hasText: '查看全部历史' }).first().click();
await page.waitForTimeout(900);

const firstContinue = page.locator('button', { hasText: '继续处理' }).first();
console.log('continue_btn_count', await firstContinue.count());
if (await firstContinue.count()===0) {
  console.log('no_continue_btn', true);
  await browser.close();
  process.exit(0);
}

const beforeUrl = page.url();
const beforeText = await page.locator('body').innerText();
await firstContinue.click();
await page.waitForTimeout(1500);
const afterUrl = page.url();
const afterText = await page.locator('body').innerText();

console.log('url_changed', beforeUrl !== afterUrl);
console.log('url', afterUrl);
console.log('text_contains_expected_title', /小伊|给我看一下后台数据|当前查看/.test(afterText));
console.log('contains_continue_tip', /可基于当前上下文继续向小伊提问/.test(afterText));
console.log('changed', beforeText !== afterText);

console.log('api_calls', reqs.filter(r=>/chat|conversation|tickets|bootstrap/i.test(r.url)));

await browser.close();
