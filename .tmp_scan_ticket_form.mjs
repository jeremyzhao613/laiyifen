import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

await page.getByRole('button', { name: '工单反馈' }).click().catch(()=>{});
await page.waitForTimeout(900);

const inputs = page.locator('input');
const textareas = page.locator('textarea');
const selects = page.locator('select');
const buttons = page.locator('button');
console.log('inputs', await inputs.count());
for (let i=0;i<Math.min(await inputs.count(),20);i++) {
  const el = inputs.nth(i);
  console.log('input', i, JSON.stringify(await el.getAttribute('placeholder')), await el.getAttribute('name'), await el.getAttribute('type'), await el.getAttribute('value'));
}
console.log('textareas', await textareas.count());
for (let i=0;i<Math.min(await textareas.count(),20);i++) {
  const el = textareas.nth(i);
  console.log('textarea', i, JSON.stringify(await el.getAttribute('placeholder')), await el.getAttribute('name'), await el.inputValue().catch(()=>'')); 
}
console.log('selects', await selects.count());
for (let i=0;i<Math.min(await selects.count(),20);i++) {
  const el = selects.nth(i);
  const vals = await el.locator('option').allTextContents();
  console.log('select', i, 'name', await el.getAttribute('name'), 'opts', vals.slice(0,20));
}

console.log('buttons', await buttons.allTextContents().filter(t => (t||'').trim()));

const allText = await page.locator('body').innerText();
console.log('body_snippet', allText.slice(0,2800));
await browser.close();
