import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const notices = [];

page.on('console', msg => {
  const t = msg.text();
  if (/请|评分|反馈|error|error/i.test(t)) notices.push(t);
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

await page.locator('button.ly-rate').click();
await page.waitForTimeout(500);

const submitBtn = page.locator('button').filter({ hasText: /^提交$/ });
console.log('submit_button_count', await submitBtn.count());

const beforeText = await page.locator('body').innerText();
if (await submitBtn.count()) {
  await submitBtn.first().click();
  await page.waitForTimeout(700);
}

const afterText = await page.locator('body').innerText();
console.log('text_changed', beforeText !== afterText);
console.log('contains_need_rate_text', /请/.test(afterText) && /评分/.test(afterText) ? true : /请先/.test(afterText));
console.log('contains_submitted', /提交成功|已提交|thank|谢谢/.test(afterText));
console.log('console_notices', notices);
console.log('final_snippet', afterText.slice(0, 1800));

await browser.close();
