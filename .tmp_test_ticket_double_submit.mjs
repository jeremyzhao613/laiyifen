import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];

  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '工单反馈' }).click();
  await page.waitForTimeout(500);

  // fill required
  await page.locator('.ly-ticket-form select').first().selectOption({ index: 1 });
  await page.locator('.ly-ticket-form textarea').fill('重复提交测试');

  const submitBtn = page.getByRole('button', { name: '提交工单' });

  await submitBtn.click();
  await submitBtn.click();
  await submitBtn.click();

  await page.waitForTimeout(1800);

  const posts = events.filter((x) => x.startsWith('POST') && x.includes('/api/tickets')).length;
  const noticeText = (await page.locator('.ly-ticket-notice').textContent().catch(() => '')).trim();

  console.log(JSON.stringify({
    posts,
    noticeText,
    postsList: events.filter((x) => x.includes('/api/tickets'))
  }, null, 2));

  await browser.close();
})();
