import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: '提交新工单' }).click();
await page.waitForTimeout(500);

const province = page.locator('select').nth(3);
const city = page.locator('select').nth(4);
const district = page.locator('select').nth(5);

const cityBefore = await city.locator('option').allTextContents();
console.log('city_before', cityBefore);

await province.selectOption({ value: '江苏省' });
await page.waitForTimeout(400);
const cityAfter = await city.locator('option').allTextContents();

await district.selectOption({ index: 1 });
await page.waitForTimeout(400);
const districtAfter = await district.locator('option').allTextContents();

console.log('city_after', cityAfter);
console.log('district_after', districtAfter);

console.log('province_idx_after', await province.evaluate(el=>el.selectedIndex));
console.log('city_idx_after', await city.evaluate(el=>el.selectedIndex));

await browser.close();
