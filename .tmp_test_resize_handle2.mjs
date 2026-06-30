import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const shell = page.locator('.ly-ai');
const startRect = await shell.boundingBox();

const handle = page.locator('button.ly-resize-handle').first();
const box = await handle.boundingBox();
await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
await page.mouse.down();
await page.mouse.move(box.x - 120, box.y + 1, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(500);

const afterRect = await shell.boundingBox();

console.log('startRect', startRect);
console.log('afterRect', afterRect);
console.log('changed', startRect && afterRect && (startRect.width !== afterRect.width || startRect.height !== afterRect.height || startRect.x !== afterRect.x));

await browser.close();
