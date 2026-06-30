import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];

page.on('request', req => {
  const u = req.url();
  if (u.includes('/api/')) reqs.push({ method: req.method(), url: u, body: req.postData() || '' });
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const beforeText = await page.locator('body').innerText();
await page.getByRole('button', { name: '转人工客服' }).first().click();
await page.waitForTimeout(1300);
const afterText = await page.locator('body').innerText();

const hasTransferMsg = /转人工客服/.test(afterText);
const hasSuccess = /已提交|工单|处理中|转人工客服/.test(afterText);
const hasNotice = /请先|失败|错误|已提交/.test(afterText);

console.log('text_changed', beforeText !== afterText);
console.log('has_success_word', hasSuccess);
console.log('has_notice', hasNotice);
console.log('api_tail', reqs.slice(-12));

await browser.close();
