import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];
page.on('request', req => {
  const u = req.url();
  if (u.includes('/api/')) reqs.push({method:req.method(), url:u});
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const textBefore = await page.locator('body').innerText();
const transferBtn = page.locator('button', { hasText: '转人工客服' }).first();
console.log('home_transfer_found', await transferBtn.count() > 0);
await transferBtn.click();
await page.waitForTimeout(1200);
const textAfter = await page.locator('body').innerText();
console.log('home_text_changed', textBefore !== textAfter);
console.log('home_transfer_text', /转人工客服/.test(textAfter));
console.log('home_requests', reqs.slice(-10));

// history detail path
await page.locator('button', { hasText: '查看全部历史' }).first().click();
await page.waitForTimeout(1000);

const continueTransferBtn = page.locator('text=继续处理');
console.log('history_continue_count', await continueTransferBtn.count());
if (await continueTransferBtn.count()) {
  const before2 = await page.locator('body').innerText();
  await continueTransferBtn.first().click();
  await page.waitForTimeout(900);
  const after2 = await page.locator('body').innerText();
  console.log('history_continue_click_changed', before2 !== after2);
  console.log('history_requests_tail', reqs.slice(-12));
}

await browser.close();
