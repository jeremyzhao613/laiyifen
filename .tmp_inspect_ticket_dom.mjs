import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '工单反馈' }).click();
  await page.waitForTimeout(600);

  const inputs = await page.$$eval('form .ly-ticket-form-row, form .ly-ticket-form-grid, form select, form textarea, form input, form button', els =>
    els.map((el) => ({
      tag: el.tagName,
      type: el.getAttribute('type') || '',
      cls: el.className,
      text: (el.textContent || '').trim().slice(0, 80),
      name: el.getAttribute('name') || '',
      id: el.getAttribute('id') || '',
      label: (el.previousElementSibling && el.previousElementSibling.textContent) || '',
      value: el.value || ''
    }))
  );

  const visibleButtons = await page.locator('button').allTextContents();
  console.log(JSON.stringify({
    visibleButtons: [...new Set(visibleButtons.map((x) => x.trim()).filter(Boolean))],
    formFields: inputs.filter((x) => x.tag === 'SELECT' || x.tag === 'TEXTAREA' || x.tag === 'INPUT').slice(0, 50),
    all: inputs.slice(0, 30)
  }, null, 2));

  await browser.close();
})();
