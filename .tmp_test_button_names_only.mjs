import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const buttons = await page.getByRole('button').allTextContents();
console.log('count', buttons.length);
console.log(buttons.slice(0, 30));

await browser.close();
