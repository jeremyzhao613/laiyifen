import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const editable = page.locator('[contenteditable="true"]');
const count = await editable.count();
console.log('editable_count', count);
for (let i=0; i<count; i++) {
  const e = editable.nth(i);
  const tag = await e.evaluate(el => el.tagName);
  const text = (await e.textContent())?.slice(0,200);
  const cls = await e.getAttribute('class');
  const ph = await e.getAttribute('placeholder');
  console.log(i, tag, 'class=', cls, 'placeholder=', ph, 'text=', text);
}

await browser.close();
