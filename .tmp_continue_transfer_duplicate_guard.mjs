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
await page.waitForTimeout(1000);

await page.locator('button', { hasText: '转人工客服' }).first().click();
await page.waitForTimeout(1200);
const btn = page.locator('text=继续转人工').first();
console.log('btn_count', await btn.count());

if (await btn.count()) {
  await btn.click();
  await page.waitForTimeout(700);
  const beforeBody = await page.locator('body').innerText();
  await btn.click();
  await page.waitForTimeout(1000);
  const afterBody = await page.locator('body').innerText();
  console.log('posts', posts.length);
  console.log('first_and_second_payloads_same?', posts.length>=1 ? posts.map(j=>{try{return JSON.parse(j).title}catch{return ''}}) : []);
  console.log('body_contains_success', /已提交工单/.test(afterBody));
  console.log('body_changed_after_second_click', beforeBody !== afterBody);
  console.log('contains_人工客服工作时间', /人工客服工作时间/.test(afterBody));
}

await browser.close();
