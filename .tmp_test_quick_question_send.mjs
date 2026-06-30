import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const api = [];

page.on('requestfinished', req => {
  const u = req.url();
  if (u.includes('/api/')) api.push({url:u, method:req.method()});
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

const chatItems = page.locator('button').filter({ hasText: /客服 · 1d/ }).first();
const hasItem = await chatItems.count();
console.log('quick_button_found', hasItem > 0);

if (hasItem) {
  const beforeText = await page.locator('body').innerText();
  await chatItems.click();
  await page.waitForTimeout(3000);
  const afterText = await page.locator('body').innerText();

  const userQuestionInDom = /给我看一下后台数据/.test(afterText);
  const hasReply = /小伊|你好|请/.test(afterText);

  console.log('text_changed', beforeText !== afterText);
  console.log('user_question_in_dom', userQuestionInDom);
  console.log('reply_like', hasReply);
  console.log('api_calls', api);
}

await browser.close();
