import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: '历史对话' }).click();
  await page.waitForTimeout(1000);

  const list = await page.$$eval('button, article, .ly-history-submenu-list button, .ly-history-list, .ly-history-layout, .ly-history-item', (els) =>
    els.map((el) => ({
      tag: el.tagName,
      cls: el.className,
      text: (el.textContent || '').trim().slice(0, 60)
    }))
      .filter(x => x.text.length > 0)
      .slice(0, 80)
  );

  const historySubmenu = await page.locator('.ly-history-submenu-list').textContent().catch(()=> '');
  const historyCount = await page.locator('.ly-history-submenu-all').count();

  const allButtons = await page.locator('.ly-history-submenu-list button, .status-card, .ly-history-filter button, .ly-history-result-bar button, .ly-history-followups button').allTextContents();

  console.log(JSON.stringify({
    list,
    historySubmenu,
    historyCount,
    allButtons: [...new Set(allButtons.map((x) => x.trim()).filter(Boolean))]
  }, null, 2));

  await page.close();
  await browser.close();
})();
