import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(800);

const quickBtn = page.locator('button').filter({ hasText: /^换一换$/ });
const quickItemsSel = page.locator('button').filter({ hasText: /客服/ });

function snapshotItems() {
  return quickItemsSel.allTextContents();
}

const before1 = (await snapshotItems()).map((s) => s.trim()).filter(Boolean);
await quickBtn.first().click();
await page.waitForTimeout(900);
const after1 = (await snapshotItems()).map((s) => s.trim()).filter(Boolean);
await quickBtn.first().click();
await page.waitForTimeout(900);
const after2 = (await snapshotItems()).map((s) => s.trim()).filter(Boolean);
await quickBtn.first().click();
await page.waitForTimeout(900);
const after3 = (await snapshotItems()).map((s) => s.trim()).filter(Boolean);

console.log('before1', before1);
console.log('after1', after1);
console.log('after2', after2);
console.log('after3', after3);
console.log('same1', JSON.stringify(before1)===JSON.stringify(after1));
console.log('same2', JSON.stringify(after1)===JSON.stringify(after2));
console.log('same3', JSON.stringify(after2)===JSON.stringify(after3));

await browser.close();
