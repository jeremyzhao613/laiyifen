import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];

page.on('request', req => {
  const u = req.url();
  if (u.includes('/api/')) reqs.push({method: req.method(), url: u});
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

const beforeText = await page.locator('body').innerText();
const rateBtn = page.locator('button.ly-rate');
await rateBtn.click().catch(()=>{});
await page.waitForTimeout(1200);
const afterText = await page.locator('body').innerText();

console.log('has_rate_btn', await rateBtn.count() > 0);
console.log('content_changed', beforeText !== afterText);
console.log('length_delta', afterText.length - beforeText.length);
console.log('contains_star', /评价|评分|反馈|star|好评|差评|服务/.test(afterText));
console.log('rate_api_count', reqs.length);
console.log('rate_apis', reqs);

await browser.close();
