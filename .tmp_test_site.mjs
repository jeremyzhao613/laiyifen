import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const logs = [];

  const apiCalls = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/')) {
      apiCalls.push(req.method() + ' ' + req.url());
      logs.push({ type: 'request', method: req.method(), url: req.url() });
    }
  });
  page.on('response', res => {
    const url = res.url();
    if (url.includes('/api/')) {
      logs.push({ type: 'response', status: res.status(), method: res.request().method(), url });
    }
  });
  page.on('popup', popup => {
    logs.push({ type: 'popup', url: popup.url() });
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const composer = page.locator('textarea').first();
  await composer.waitFor({ state: 'visible', timeout: 10000 });
  await composer.fill('我这个合同授权卡在待确认，下一步怎么做？');
  await page.locator('button[aria-label="发送"]').click();

  await page.waitForTimeout(2500);
  const actionButtons = page.locator('.ly-message-actions button');
  const actionCount = await actionButtons.count();
  let firstActionText = '';
  if (actionCount > 0) {
    firstActionText = (await actionButtons.nth(0).textContent())?.trim() || '';
    await actionButtons.nth(0).click();
  }

  await page.waitForTimeout(2000);

  const result = {
    actionCount,
    firstActionText,
    apiCalls,
    logs: logs.slice(-40)
  };

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
