import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(800);

const buttons = page.locator('button');
const count = await buttons.count();
const items = [];
for (let i = 0; i < count; i++) {
  const el = buttons.nth(i);
  const txt = (await el.textContent())?.trim() || '';
  const disabled = await el.isDisabled();
  const visible = await el.isVisible();
  if (txt) items.push({ idx: i, text: txt, disabled, visible });
}

console.log('BUTTON_COUNT', count);
console.log('VISIBLE_BUTTONS', items);

const inputs = page.locator('input');
const inputCount = await inputs.count();
console.log('INPUT_COUNT', inputCount);
for (let i = 0; i < inputCount; i++) {
  const inp = inputs.nth(i);
  const ph = await inp.getAttribute('placeholder');
  const disabled = await inp.isDisabled();
  const type = await inp.getAttribute('type');
  const val = await inp.inputValue().catch(() => '');
  console.log('INPUT', i, 'type=', type, 'placeholder=', ph, 'disabled=', disabled, 'value=', val);
}

const textareas = page.locator('textarea');
console.log('TEXTAREA_COUNT', await textareas.count());

await browser.close();
