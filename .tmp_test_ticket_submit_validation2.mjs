import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];

  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });
  page.on('response', res => { if (res.url().includes('/api/')) events.push(`RESP ${res.status()} ${res.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '工单反馈' }).click();
  await page.waitForTimeout(600);

  // required validation empty
  await page.getByRole('button', { name: '提交工单' }).click();
  await page.waitForTimeout(300);
  const notice1 = await page.locator('.ly-ticket-notice').textContent().catch(() => '');

  // choose first question type by index
  const sel = page.locator('form .ly-ticket-form-row').first().locator('select');
  const options = await sel.locator('option').allTextContents();
  const postCountBefore = events.length;

  await sel.selectOption({ index: 1 });
  await page.locator('form textarea').fill('测试工单提交接口');

  // ensure name+phone still present
  const name = await page.locator('input').filter({ hasValue: '王敏' }).first().inputValue().catch(() => '');
  await page.locator('button:has-text("提交工单")').click();
  await page.waitForTimeout(1100);

  const notice2 = await page.locator('.ly-ticket-notice').textContent().catch(() => '');
  const createdVisible = await page.locator('.ly-ticket-list article').first().textContent().catch(() => '');

  console.log(JSON.stringify({
    events,
    options,
    notice1: notice1?.trim(),
    notice2: notice2?.trim(),
    hasCreated: /已提交工单|TK-/.test(notice2) || /TK-/.test(createdVisible),
    postTicket: events.filter((x) => x.includes('/api/tickets') && x.startsWith('POST')).length,
    postAfter: events.slice(postCountBefore),
    selectedText: await sel.locator('option:checked').first().textContent()
  }, null, 2));

  await browser.close();
})();
