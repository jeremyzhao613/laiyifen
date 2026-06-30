import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);
await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: '提交新工单' }).click();
await page.waitForTimeout(500);

const province = page.locator('select').nth(3);
const city = page.locator('select').nth(4);
const district = page.locator('select').nth(5);

console.log('initial province', await province.evaluate(el=>Array.from(el.options).map(o=>o.textContent)));
console.log('initial city', await city.evaluate(el=>Array.from(el.options).map(o=>o.textContent)));
console.log('initial district', await district.evaluate(el=>Array.from(el.options).map(o=>o.textContent)));

await province.selectOption('上海市');
await page.waitForTimeout(300);
console.log('after 上海市 -> city', await city.evaluate(el=>Array.from(el.options).map(o=>o.textContent)));
console.log('after 上海市 -> district', await district.evaluate(el=>Array.from(el.options).map(o=>o.textContent)));

await city.selectOption('南京市');
await page.waitForTimeout(300);
console.log('after 南京市 -> district', await district.evaluate(el=>Array.from(el.options).map(o=>o.textContent)));

await city.selectOption('杭州市');
await page.waitForTimeout(300);
console.log('after 杭州市 -> district', await district.evaluate(el=>Array.from(el.options).map(o=>o.textContent)));

await browser.close();
