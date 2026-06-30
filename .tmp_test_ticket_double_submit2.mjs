import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];
  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '工单反馈' }).click();
  await page.waitForTimeout(800);

  const submit = page.locator('form.ly-ticket-form button[type="submit"]');
  const subCount = await submit.count();
  const vis = await submit.isVisible().catch(() => false);
  await page.locator('.ly-ticket-form select').first().selectOption({ index: 1 });
  await page.locator('.ly-ticket-form textarea').fill('重复提交测试');

  const disabledBefore = await submit.isDisabled().catch(()=>false);
  await submit.click();
  await submit.click();
  await submit.click();
  await page.waitForTimeout(1400);

  const posts = events.filter((x) => x.startsWith('POST') && x.includes('/api/tickets')).length;

  console.log(JSON.stringify({
    subCount,
    vis,
    disabledBefore,
    posts,
    ticketReqs: events.filter((x)=>x.includes('/api/tickets')),
    formVisible: await page.locator('form.ly-ticket-form').isVisible().catch(()=>false),
    listVisible: await page.locator('.ly-ticket-list').isVisible().catch(()=>false)
  }, null, 2));

  await browser.close();
})();
