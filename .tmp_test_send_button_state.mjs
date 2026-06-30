import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1400);

const input = page.locator('textarea').first();
const sendBtn = page.locator('button.ly-send').first();
console.log('initial_send_enabled', await sendBtn.isEnabled());
await input.fill('abc');
await page.waitForTimeout(200);
console.log('afterfill_send_enabled', await sendBtn.isEnabled());
console.log('text_in_input', await input.inputValue());

await input.focus();
await input.press('Enter');
await page.waitForTimeout(800);
console.log('after_enter_send_enabled', await sendBtn.isEnabled());
console.log('input_after', await input.inputValue());

await browser.close();
