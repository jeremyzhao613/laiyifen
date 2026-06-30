import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

const roles = ['textbox', 'searchbox', 'log', 'list', 'button', 'combobox'];
for (const r of roles) {
  try {
    const c = await page.getByRole(r).count();
    console.log(r, c);
  } catch (e) {
    console.log(r, 'err');
  }
}

await browser.close();
