import { chromium } from 'playwright';
import fs from 'fs';
fs.writeFileSync('/tmp/rst-ticket.txt', 'reset');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: '提交新工单' }).click();
await page.waitForTimeout(400);

await page.locator('select').nth(1).selectOption({ index: 3 });
await page.locator('textarea').first().fill('待重置内容');
await page.getByPlaceholder('请输入反馈人姓名').fill('要清除');
await page.getByPlaceholder('请输入反馈人手机号').fill('13800110011');
await page.locator('input[type="file"]').first().setInputFiles('/tmp/rst-ticket.txt');
await page.waitForTimeout(500);

const before = {
  desc: await page.locator('textarea').first().inputValue(),
  name: await page.getByPlaceholder('请输入反馈人姓名').inputValue(),
  phone: await page.getByPlaceholder('请输入反馈人手机号').inputValue(),
  hasFile: /rst-ticket\.txt/.test(await page.locator('body').innerText()),
};

await page.getByRole('button', { name: '重置' }).click();
await page.waitForTimeout(500);

const after = {
  desc: await page.locator('textarea').first().inputValue(),
  name: await page.getByPlaceholder('请输入反馈人姓名').inputValue(),
  phone: await page.getByPlaceholder('请输入反馈人手机号').inputValue(),
  hasFile: /rst-ticket\.txt/.test(await page.locator('body').innerText()),
  feedbackTypeIdx: await page.locator('select').nth(1).evaluate(el => el.selectedIndex),
};

console.log('before', before);
console.log('after', after);

await browser.close();
