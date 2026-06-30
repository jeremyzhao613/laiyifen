import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const chatPane = page.locator('.ly-chatbot');
const container = await page.locator('.ly-pane').first();
const layout = await page.locator('.ly-history-layout').first();

const paneRect0 = await chatPane.boundingBox();
const contRect0 = await container.boundingBox();
const layoutRect0 = await layout.boundingBox();

const handle = page.locator('button.ly-resize-handle');
console.log('handle_count', await handle.count());
if (await handle.count()) {
  const box = await handle.first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + box.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(800);
}

const paneRect1 = await chatPane.boundingBox();
const contRect1 = await container.boundingBox();
const layoutRect1 = await layout.boundingBox();

console.log('pane_before', paneRect0, 'pane_after', paneRect1);
console.log('container_before', contRect0, 'container_after', contRect1);
console.log('layout_before', layoutRect0, 'layout_after', layoutRect1);

await browser.close();
