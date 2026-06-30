import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];
page.on('request', req => {
  const u = req.url();
  if (u.includes('/api/')) reqs.push({ method: req.method(), url: u });
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(1200);

await page.getByRole('button', { name: '工单列表' }).click();
await page.waitForTimeout(1200);

const before = await page.locator('body').innerText();
const returnBtn = page.getByRole('button', { name: '返回对话' });
console.log('return_btn_count', await returnBtn.count());
if (await returnBtn.count()) {
  await returnBtn.first().click();
  await page.waitForTimeout(1000);
  const after = await page.locator('body').innerText();
  const ticketUrl = page.url().includes('工单');
  console.log('url_changed', page.url());
  console.log('text_changed', after !== before);
  console.log('contains_chat_prompt', /您好|我要咨询|你好/.test(after));
  console.log('contains_ticket_header', /工单/.test(after));
}

console.log('requests', reqs.slice(-10));
await browser.close();
