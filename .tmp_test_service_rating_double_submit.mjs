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

const submit = page.getByRole('button', { name: /^提交$/ });
await submit.waitFor({ state: 'visible', timeout: 5000 }).catch(()=>{});
const submitCount = await submit.count();
console.log('submit_count_before', submitCount);
console.log('page_body_has_submit', await submit.first().isVisible().catch(()=>false));

if (submitCount > 0) {
  // click submit first
  await submit.first().click();
  await page.waitForTimeout(1000);

  // after success, click submit again if it remains
  const submit2Count = await submit.count();
  console.log('submit_count_after_first', submit2Count);
  if (submit2Count) {
    const submitEnabled = await submit.first().isEnabled();
    console.log('submit_enabled_after_success', submitEnabled);
    if (submitEnabled) {
      await submit.first().click();
      await page.waitForTimeout(900);
    }
  }
}

console.log('requests', reqs);
await page.screenshot({ path: '/tmp/rating-after.png', fullPage: true }).catch(()=>{});

await browser.close();
