import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];

page.on('request', req => {
  const u = req.url();
  if (u.includes('/api/') || u.includes('chat') || u.includes('socket') || u.includes('stream')) {
    reqs.push({ method: req.method(), url: u });
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const textbox = page.getByRole('textbox').first();
const sendBtn = page.getByRole('button', { name: '发送' }).first();
const initialBody = await page.locator('body').innerText();

await textbox.fill('帮我测试一下');
await page.waitForTimeout(300);
console.log('send_enabled_after_fill', await sendBtn.isEnabled());
await sendBtn.click().catch(() => {});
await page.waitForTimeout(3000);

const afterBody = await page.locator('body').innerText();

console.log('body_changed', initialBody !== afterBody);
console.log('contains_input_echo', /帮我测试一下/.test(afterBody));
console.log('contains_assistant_reply', /小伊|可以|请/.test(afterBody));
console.log('api_requests', reqs);

await browser.close();
