import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const msg = [];

page.on('request', req => {
  const u = req.url();
  if (u.includes('/api/chat/')) {
    msg.push({ method: req.method(), url: u, body: req.postData() || '' });
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const sendMsg = async (text) => {
  await page.getByRole('textbox').fill(text);
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: '发送' }).click();
  await page.waitForTimeout(1200);
};

await sendMsg('第一条会话消息');
const sidAfterFirst = extractSessionIds(msg);

await page.getByRole('button', { name: '新建对话' }).click();
await page.waitForTimeout(700);
await sendMsg('第二条会话消息');
const sidAfterSecond = extractSessionIds(msg);

console.log('chatReqs', msg);
console.log('firstSessionIds', sidAfterFirst);
console.log('secondSessionIds', sidAfterSecond);

const afterText = await page.locator('body').innerText();
console.log('has_first_after_newchat', /第一条会话消息/.test(afterText));

await browser.close();

function extractSessionIds(list) {
  return list
    .filter((x) => x.url.includes('/api/chat/message'))
    .map((x) => {
      try {
        return JSON.parse(x.body).sessionId;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
