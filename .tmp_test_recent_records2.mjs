import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const buttons = page.getByRole('button');
const count = await buttons.count();
const candidates = [];
for (let i=0; i<count; i++) {
  const b = buttons.nth(i);
  const txt = (await b.textContent())?.trim() || '';
  const name = (await b.getAttribute('aria-label')) || '';
  const cls = await b.getAttribute('class');
  if ((txt + ' ' + name).includes('最近记录') || (cls || '').includes('ly-history-submenu-head')) {
    candidates.push({idx: i, txt, name, cls});
  }
}
console.log('candidates', candidates);

const apiReqs = [];
page.on('request', req=>{ if (req.url().includes('/api/')) apiReqs.push(req.url()); });
if (candidates.length) {
  const idx = candidates[0].idx;
  const btn = buttons.nth(idx);
  const beforeText = await page.locator('body').innerText();
  const beforeUrl = page.url();
  await btn.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(900);
  const afterText = await page.locator('body').innerText();
  console.log('clicked', idx, candidates[0].txt || candidates[0].name);
  console.log('urlChanged', page.url() !== beforeUrl);
  console.log('content_changed', beforeText !== afterText);
  console.log('lenDiff', afterText.length - beforeText.length);
  console.log('after_contains_history', /历史对话/.test(afterText));
} else {
  console.log('no_candidates');
}

console.log('apiReqs', apiReqs);
await browser.close();
