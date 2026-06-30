import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(800);

const buttons = page.getByRole('button');
const target = buttons.nth(2); // 最近记录3 index found earlier

const before = (await page.locator('body').allTextContents())[0];
// split lines
console.log('BEFORE_LINES', before.split('\n').filter(Boolean));

await target.click();
await page.waitForTimeout(900);
const after = (await page.locator('body').allTextContents())[0];
console.log('AFTER_LINES', after.split('\n').filter(Boolean));

await browser.close();
