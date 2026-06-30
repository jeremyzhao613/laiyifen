import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1500);
const buttons = page.getByRole('button');
const n = await buttons.count();
for (let i = 0; i < n; i++) {
  const b = buttons.nth(i);
  const text = (await b.textContent())?.trim() || '';
  const name = await b.getAttribute('aria-label');
  const title = await b.getAttribute('title');
  const testid = await b.getAttribute('data-testid');
  const id = await b.getAttribute('id');
  const disabled = await b.isDisabled();
  const cls = await b.getAttribute('class');
  console.log(i, JSON.stringify(text), 'name=', JSON.stringify(name), 'title=', JSON.stringify(title), 'id=', id, 'disabled=', disabled, 'class=', cls);
}
await page.close();
await browser.close();
