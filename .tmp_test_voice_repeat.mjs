import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const voice = page.locator('button[aria-label="语音输入"]');
console.log('voice_count', await voice.count());

const before = await page.locator('body').innerText();
for (let i=0;i<3;i++) {
  await voice.click();
  await page.waitForTimeout(500);
}
const after = await page.locator('body').innerText();

const beforeCount = (before.match(/当前环境暂时无法访问麦克风/g) || []).length;
const afterCount = (after.match(/当前环境暂时无法访问麦克风/g) || []).length;
const unique = Array.from(new Set(after.match(/当前环境暂时无法访问麦克风/g) || []));

console.log('beforeNoticeCount', beforeCount);
console.log('afterNoticeCount', afterCount);
console.log('notice_delta', afterCount - beforeCount);
console.log('voice_button_pressed', await voice.getAttribute('aria-pressed'));

console.log('snippet', after.match(/当前环境暂时无法访问麦克风.{0,100}/g)?.[0]);
await browser.close();
