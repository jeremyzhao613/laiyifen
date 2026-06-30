import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

const before = (await page.locator('body').allTextContents())[0];
await page.locator('button.ly-rate').click().catch(()=>{});
await page.waitForTimeout(1200);
const after = (await page.locator('body').allTextContents())[0];

const bLines = before.split('\n').filter(Boolean);
const aLines = after.split('\n').filter(Boolean);

function onlyDiffLines(a,b){
  const aset = new Set(a);
  return b.filter((x)=>!aset.has(x));
}

console.log('added_lines', onlyDiffLines(bLines,aLines));
console.log('remaining_lines', aLines.filter((x)=>!new Set(bLines).has(x)));
console.log('after_lines_count', aLines.length, bLines.length);

await browser.close();
