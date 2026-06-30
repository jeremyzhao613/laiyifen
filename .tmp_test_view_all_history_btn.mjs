import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const apiReqs = [];
page.on('request', req=>{ const u=req.url(); if (u.includes('/api/')) apiReqs.push(u); });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const viewAll1 = page.locator('button.ly-history-submenu-all');
const viewAll2 = page.locator('button', { hasText: '查看全部历史' });
console.log('viewAll1_count', await viewAll1.count());
console.log('viewAll2_count', await viewAll2.count());

let before = await page.locator('body').innerText();
if (await viewAll2.count() > 0) {
  await viewAll2.first().click();
  await page.waitForTimeout(900);
  const after = await page.locator('body').innerText();
  console.log('clicked_view_all', true);
  console.log('urlChanged', page.url());
  console.log('changed', before !== after);
  console.log('includes_近期', /最近记录/.test(after), 'includes_会话'.replace('会话',''));
  console.log('snippet_after', after.slice(0, 1800));
} else if (await viewAll1.count() > 0) {
  await viewAll1.first().click();
  await page.waitForTimeout(900);
  const after = await page.locator('body').innerText();
  console.log('clicked_view_all_class', true);
  console.log('urlChanged', page.url());
  console.log('changed', before !== after);
  console.log('snippet_after', after.slice(0, 1800));
} else {
  console.log('view_all_not_found');
}

console.log('apiReqs', apiReqs);
await browser.close();
