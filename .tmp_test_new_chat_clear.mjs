import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];

page.on('request', req => {
  const url = req.url();
  if (url.includes('/api/')) reqs.push({ method: req.method(), url, body: req.postData() || '' });
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const input = page.getByRole('textbox');
await input.fill('测试清空上下文');
await page.waitForTimeout(200);
await page.getByRole('button', { name: '发送' }).click();
await page.waitForTimeout(2200);

const before = await page.locator('body').innerText();
const beforeHasMessage = /测试清空上下文/.test(before);

await page.getByRole('button', { name: '新建对话' }).click();
await page.waitForTimeout(900);
const after = await page.locator('body').innerText();

const afterHasMessage = /测试清空上下文/.test(after);
const hasWelcome = /你好，我是小伊!有什么可以帮您的/.test(after);

console.log('beforeHasMessage', beforeHasMessage);
console.log('afterHasMessage', afterHasMessage);
console.log('hasWelcome', hasWelcome);
console.log('apiCalls', reqs.filter(r => /\/api\//.test(r.url)));

await browser.close();
