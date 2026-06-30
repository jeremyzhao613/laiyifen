import { chromium } from 'playwright';
import fs from 'fs';
for (let i=1;i<=5;i++) fs.writeFileSync(`/tmp/tix${i}_x.txt`, `file-${i}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);
await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: '提交新工单' }).click();
await page.waitForTimeout(500);

await page.locator('input[type="file"]').first().setInputFiles(['/tmp/tix1_x.txt','/tmp/tix2_x.txt','/tmp/tix3_x.txt','/tmp/tix4_x.txt','/tmp/tix5_x.txt']);
await page.waitForTimeout(600);

const text = await page.locator('body').innerText();
const nearLabel = text.match(/上传.*4|最多 4|附件|tix/g);
const idx = text.indexOf('tix5_x.txt');
console.log('found_tix5', idx !== -1);
console.log('text_preview', text.slice(text.indexOf('附件'), text.indexOf('附件') + 500));
console.log('upload_limit_phrase', /最多 4/.test(text) );
console.log('has_error_phrase', /最多 4 个附件|超出|不能/.test(text));

await page.close();
await browser.close();
