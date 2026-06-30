import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];
page.on('request', req => {
  if (req.url().includes('/api/')) reqs.push({method:req.method(), url:req.url()});
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);
await page.locator('button', { hasText: '查看全部历史' }).first().click();
await page.waitForTimeout(900);

const buttons = [
  '全部',
  'AI 对话',
  '客服对话',
  '进行中',
  '0AI 对话',
  '3客服对话',
  '0进行中',
].map((t) => page.locator('button', { hasText: t }));

for (let i = 0; i < buttons.length; i++) {
  const b = buttons[i];
  const t = ['全部','AI 对话','客服对话','进行中','0AI 对话','3客服对话','0进行中'][i];
  const count = await b.count();
  if (!count) {
    console.log(t, 'not found');
    continue;
  }
  const before = await page.locator('body').innerText();
  const beforeUrl = page.url();
  await b.first().click();
  await page.waitForTimeout(700);
  const after = await page.locator('body').innerText();
  console.log(t, 'clicked', before !== after, 'urlchg', page.url() !== beforeUrl, 'changed_len', after.length - before.length);
  console.log(t, 'has_match_line', /匹配结果/.test(after), 'contains_current', /当前查看/.test(after));
}

console.log('api_total', reqs.length);
console.log('api_tail', reqs.slice(-10));

await browser.close();
