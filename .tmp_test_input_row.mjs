import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const row = page.locator('.ly-input-row');
const html = await row.innerHTML();
console.log(html.slice(0, 2000));

const body = await page.locator('body').innerHTML();
const idx = body.indexOf('ly-input-row');
console.log('index', idx);

await browser.close();
