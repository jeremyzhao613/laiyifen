import { chromium } from 'playwright';

const reqs = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

page.on('request', (req) => {
  const url = req.url();
  if (url.includes('/api/')) reqs.push({ method: req.method(), url });
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

const recentBtn = page.getByRole('button', { name: '最近记录3' });
const recentVisible = await recentBtn.count();
let expanded = false;
let listVisible = false;
let urlChanged = false;

if (recentVisible) {
  const before = await page.locator('body').innerText();
  const beforeUrl = page.url();
  await recentBtn.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);

  const after = await page.locator('body').innerText();
  urlChanged = page.url() !== beforeUrl;
  expanded = before !== after;
  listVisible = /对话记录|历史对话|最近记录/.test(after) && /查看全部历史|客服/.test(after);

  console.log('recent_btn_clicked', true);
  console.log('urlChanged', urlChanged);
  console.log('content_changed', expanded);
  console.log('list_related_text', listVisible);
  console.log('after_snippet', after.slice(0, 1000));
} else {
  console.log('recent_btn_found', false);
}

console.log('api_count', reqs.length);
console.log('api_sample', reqs.slice(-10));

await browser.close();
