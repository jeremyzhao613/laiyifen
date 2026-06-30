import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];

page.on('request', req => {
  if (req.url().includes('/api/rating') || req.url().includes('/api/feedback') || req.url().includes('/api/')) {
    reqs.push({ method: req.method(), url: req.url() });
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const rateBtn = page.getByRole('button', { name: '评价服务' }).first();
await rateBtn.click();
await page.waitForTimeout(900);

const submit = page.locator('button', { hasText: /^提交$/ }).first();
const submitCount = await submit.count();
console.log('submit_count_before', submitCount);
console.log('submit_visible', submitCount ? await submit.isVisible().catch(()=>false) : false);

if (submitCount && await submit.isVisible().catch(()=>false)) {
  // click submit first
  await submit.click();
  await page.waitForTimeout(1000);

  // after success, maybe still has submit button
  const submit2 = page.locator('button', { hasText: /^提交$/ }).first();
  const submit2Count = await submit2.count();
  console.log('submit_count_after_first', submit2Count);
  if (submit2Count) {
    const submitEnabled = await submit2.isEnabled().catch(()=>false);
    console.log('submit_enabled_after_success', submitEnabled);
    if (submitEnabled) {
      await submit2.click();
      await page.waitForTimeout(900);
    }
  }
}

console.log('requests', reqs);
const body = await page.locator('body').innerText();
console.log('contains_submitted', body.includes('已提交本次服务评价'));

await browser.close();
