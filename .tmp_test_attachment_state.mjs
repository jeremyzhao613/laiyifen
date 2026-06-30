import { chromium } from 'playwright';
import fs from 'fs';

fs.writeFileSync('/tmp/sample-upload4.txt', 'state test');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

const fileInput = page.locator('input[type="file"]').first();
await fileInput.setInputFiles('/tmp/sample-upload4.txt');
await page.waitForTimeout(500);

const sendBtn = page.getByRole('button', { name: '发送' }).first();
await page.getByRole('textbox').fill('附件测试');
await page.waitForTimeout(200);
await sendBtn.click();
await page.waitForTimeout(2200);

const afterFirstSend = await page.locator('body').innerText();
const hasFileHint = /已添加 1 个附件/.test(afterFirstSend);
const sendAfter = await sendBtn.isEnabled();

await page.getByRole('textbox').fill('下一条消息');
await page.waitForTimeout(200);
await sendBtn.click();
await page.waitForTimeout(1500);
const afterSecondSend = await page.locator('body').innerText();

console.log('has_attachment_hint_after_first', hasFileHint);
console.log('send_enabled_after_first', sendAfter);
console.log('has_repeated_file_hint_after_second', /已添加 1 个附件/.test(afterSecondSend));
console.log('attachment_still_in_dom', /sample-upload4\.txt/.test(afterSecondSend));

await browser.close();
