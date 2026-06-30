import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];
page.on('request', (req) => {
  const url = req.url();
  if (url.includes('/api/')) reqs.push({method: req.method(), url});
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const quickBtn = page.locator('button').filter({ hasText: '换一换' });
const quickItems = page.locator('button').filter({ hasText: /客服 \· / });
const hasQuickBtn = await quickBtn.count() > 0;

let before = [];
for (let i = 0; i < Math.min(6, await quickItems.count()); i++) {
  const t = (await quickItems.nth(i).textContent())?.trim() || '';
  if (t) before.push(t);
}

await quickBtn.first().click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1200);

let after = [];
for (let i = 0; i < Math.min(6, await quickItems.count()); i++) {
  const t = (await quickItems.nth(i).textContent())?.trim() || '';
  if (t) after.push(t);
}

const dedup = (arr) => [...new Set(arr)];
const beforeChanged = JSON.stringify(dedup(before)) !== JSON.stringify(dedup(after));
const anyText = before.some(t => after.includes(t));

console.log('HAS_QUICK_BTN', hasQuickBtn);
console.log('quick_count_before', before.length);
console.log('quick_count_after', after.length);
console.log('before', before);
console.log('after', after);
console.log('changed', beforeChanged);
console.log('overlap_any', anyText);
console.log('quick_api_count', reqs.filter((r)=>/quick|suggest|suggestion|question/i.test(r.url)).length);
console.log('api_requests', reqs.slice(-8));

await browser.close();
