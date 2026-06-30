import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];

page.on('request', req => {
  if (req.url().includes('/api/')) reqs.push({ method: req.method(), url: req.url(), postData: req.postData() || '' });
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const ids = ['供应商', '加盟商', '员工', '经销商'];
const selects = page.locator('select').filter({ has: page.locator('option') });

console.log('select_count', await selects.count());
let hasIdentitySelect = false;
let identitySelect = null;
for (let i=0; i<await selects.count(); i++) {
  const sel = selects.nth(i);
  const text = (await sel.locator('option').allTextContents()).join('|');
  if (text.includes('供应商') && text.includes('加盟商')) {
    hasIdentitySelect = true;
    identitySelect = sel;
    break;
  }
}

console.log('has_identity_select', hasIdentitySelect);
if (!hasIdentitySelect) {
  await page.screenshot({ path: '/tmp/no-identity-select.png', fullPage: true }).catch(() => {});
  await browser.close();
  process.exit(0);
}

for (let i = 0; i < ids.length; i++) {
  await identitySelect.selectOption(ids[i]);
  await page.waitForTimeout(300);

  await page.getByRole('textbox').fill('测试身份切换');
  await page.getByRole('button', { name: '发送' }).click();
  await page.waitForTimeout(900);
}

console.log('reqs', reqs.filter(r => r.url.includes('/api/chat')));
console.log('bootstrap_only', reqs.every(r => !r.url.includes('/api/chat') || r.method === 'GET' || r.url.includes('/api/bootstrap')));

await browser.close();
