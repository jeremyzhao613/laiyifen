import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const tb = page.getByRole('textbox').first();
console.log('textbox_count', await page.getByRole('textbox').count());
console.log('textbox_visible', await tb.isVisible());
console.log('textbox_enabled', await tb.isEnabled());
console.log('textbox_type', await tb.evaluate((el)=>el.tagName));
console.log('textbox_inputtype', await tb.getAttribute('type'));
console.log('textbox_name', await tb.getAttribute('name'));
console.log('textbox_placeholder', await tb.getAttribute('placeholder'));
console.log('textbox_value', await tb.inputValue().catch(() => 'n/a'));

const outer = await tb.locator('..').evaluate(el => ({className: el.className, tag: el.tagName, id: el.id}));
console.log('textbox_parent', outer);

await page.close();
await browser.close();
