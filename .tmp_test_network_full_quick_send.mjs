import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];

page.on('request', req => {
  reqs.push({ method: req.method(), url: req.url() });
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

await page.locator('button', { hasText: '给我看一下后台数据客服 · 1d' }).first().click();
await page.waitForTimeout(1800);

await page.screenshot({ path: '/tmp/quick-send-requests.png', fullPage: true }).catch(()=>{});

console.log('request_count', reqs.length);
console.log('requests', reqs);

await browser.close();
