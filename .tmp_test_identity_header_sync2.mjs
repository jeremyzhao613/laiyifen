import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const idSelect = page.locator('select').first();
await idSelect.selectOption('加盟商');
await page.waitForTimeout(300);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: '提交新工单' }).click();
await page.waitForTimeout(600);

const formSelect = page.locator('select').nth(2);
const selected = await formSelect.evaluate((el) => {
  const s = el;
  return { idx: s.selectedIndex, text: s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : ''};
});

const preSelect = await page.locator('select').nth(3).evaluate((el) => {
  const s = el;
  return { idx: s.selectedIndex, text: s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : ''};
});

const headerText = await idSelect.evaluate((el) => {
  const s = el;
  return { idx: s.selectedIndex, text: s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : ''};
});

console.log('header_select', headerText);
console.log('form_partner_type', selected);
console.log('province', preSelect);

await browser.close();
