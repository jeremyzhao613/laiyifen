import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);
await page.locator('button', { hasText: '查看全部历史' }).first().click();
await page.waitForTimeout(700);

const el = page.locator('text=继续处理').first();
const info = await el.evaluate((node) => ({
  tag: node.tagName,
  role: node.getAttribute('role'),
  className: node.className,
  ariaLabel: node.getAttribute('aria-label'),
  tabindex: node.getAttribute('tabindex'),
  onclick: !!node.onclick,
  id: node.id,
}));
console.log(info);

await browser.close();
