import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];

page.on('request', req => {
  if (req.url().includes('/api/')) reqs.push({ method: req.method(), url: req.url() });
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

await page.getByRole('button', { name: '评价服务' }).click();
await page.waitForTimeout(700);

const submit = page.getByRole('button', { name: /^提交$/ }).first();
await submit.click();
await page.waitForTimeout(900);

console.log('has_success_msg', /已提交本次服务评价/.test(await page.locator('body').innerText()));
console.log('api_calls_after_submit', reqs);

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
console.log('msg_after_reload', /已提交本次服务评价/.test(await page.locator('body').innerText()));

await browser.close();
