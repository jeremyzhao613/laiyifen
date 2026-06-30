import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];
page.on('request', req => { if (req.url().includes('/api/')) reqs.push({method:req.method(),url:req.url()}); });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);
await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: '工单列表' }).click();
await page.waitForTimeout(900);

console.log('api_calls', reqs);
await page.locator('body');
const text = await page.locator('body').innerText();
console.log('has_ticket_id', /ZD-20260629-000009/.test(text));

await browser.close();
