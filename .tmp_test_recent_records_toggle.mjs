import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

const btn = page.locator('button', { hasText: '最近记录3' });
const baseline = await page.locator('body').innerText();
await btn.click();
await page.waitForTimeout(500);
const after1 = await page.locator('body').innerText();
await btn.click();
await page.waitForTimeout(500);
const after2 = await page.locator('body').innerText();

console.log('len0', baseline.length, after1.length, after2.length);
console.log('delta1', after1.length - baseline.length, 'delta2', after2.length - after1.length);
console.log('contains_quick_after1', /我这边还有哪些待办没处理？/.test(after1));
console.log('contains_quick_after2', /我这边还有哪些待办没处理？/.test(after2));

await browser.close();
