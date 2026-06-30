import { chromium } from 'playwright';

const seenReq = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1365, height: 768 } });
const page = await context.newPage();

page.on('requestfinished', (req) => {
  const url = req.url();
  if (url.includes('/api/')) {
    seenReq.push({
      method: req.method(),
      url,
    });
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const possibleHistorySelectors = [
  'text=历史对话',
  'text=历史',
  'a:has-text("历史对话")',
  '.menu a:has-text("历史")',
  'nav a:has-text("历史对话")',
];

for (const sel of possibleHistorySelectors) {
  const loc = page.locator(sel);
  if (await loc.count()) {
    await loc.first().click({ timeout: 5000 }).catch(() => {});
    break;
  }
}
await page.waitForTimeout(1200);

const row = page.locator('.conversation-item, .chat-item, .history-item, .ticket-item, .record-item, .item-card').first();
const rowCount = await row.count();
let openDetailUrlChanged = false;
let continueClicked = false;
let continueApiTouched = false;
let continueText = 'not_found';

if (rowCount > 0) {
  const before = page.url();
  await row.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  openDetailUrlChanged = page.url() !== before;
}

const continueBtn = page.locator('button').filter({ hasText: '继续处理' }).first();
const continueCount = await continueBtn.count();
if (continueCount > 0) {
  continueText = (await continueBtn.textContent())?.trim() || '继续处理';
  const before = page.url();
  await continueBtn.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1200);
  continueClicked = page.url() !== before;
  continueApiTouched = seenReq.some((item) => /\/(api|v1)\/(messages|chat|conversation|session|tickets|ticket|feedback|assist|assistant|conversation-id)/i.test(item.url));
}

await page.screenshot({ path: '/tmp/continue-debug2.png', fullPage: true }).catch(() => {});

console.log('rowCount', rowCount);
console.log('opened_detail', openDetailUrlChanged);
console.log('continue_button_text', continueText);
console.log('continue_clicked_change_url', continueClicked);
console.log('continue_clicked_api', continueApiTouched);
console.log('last_apis', seenReq.slice(-20));

await browser.close();
