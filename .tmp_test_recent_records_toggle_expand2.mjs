import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const btn = page.locator('button').filter({ hasText: '最近记录' }).first();
console.log('found', await btn.count());

const snap = [];
for (let i = 0; i < 4; i++) {
  const before = await page.locator('body').innerText();
  await btn.click();
  await page.waitForTimeout(500);
  const txt = await page.locator('body').innerText();
  snap.push({
    step: i,
    len: txt.length,
    beforeLen: before.length,
    delta: txt.length - before.length,
    hasQuick: /给我看一下后台数据/.test(txt),
    hasRecent: /最近记录/.test(txt),
    hasQuickSection: /快捷提问/.test(txt),
    hasHistoryPanel: /历史对话/.test(txt),
    snippet: txt.slice(0, 220),
  });
}

console.log(JSON.stringify(snap, null, 2));
await browser.close();
