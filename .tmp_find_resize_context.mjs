import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const all = page.locator('[class*="ly-"]');
const n = await all.count();
const uniq = new Set();
for (let i=0; i< Math.min(n, 200); i++) {
  const cls = (await all.nth(i).getAttribute('class')) || '';
  if (cls) {
    cls.split(/\s+/).forEach(c => { if (c.startsWith('ly-')) uniq.add(c); });
  }
}
console.log('sample', Array.from(uniq).sort().slice(0,120));

const btnHandle = page.locator('button.ly-resize-handle');
console.log('handle_box_count', await btnHandle.count());
if (await btnHandle.count()) {
  const rect = await btnHandle.first().boundingBox();
  console.log('handle_rect', rect);
  const parent = await btnHandle.first().evaluate((el)=>({parentClass: el.parentElement?.className, grand: el.parentElement?.parentElement?.className}));
  console.log('handle_parent', parent);
}

await browser.close();
