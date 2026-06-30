import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];
page.on('request', req => {
  const u = req.url();
  if (u.includes('/api/') || u.includes('stream') || u.includes('upload') || u.includes('file')) {
    reqs.push({ method: req.method(), url: u });
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1000);

const uploadBtn = page.locator('button', { hasText: '' }).filter({ has: page.locator('button', { hasText: '' }) }).filter({ has: page.getByRole('button', { name: '上传图片/文件' }).locator('..') });

// find by aria-label
const upload = page.locator('button[aria-label="上传图片/文件"]');
const voice = page.locator('button[aria-label="语音输入"]');
const resize = page.locator('button.ly-resize-handle');

console.log('has_upload', await upload.count());
console.log('has_voice', await voice.count());
console.log('has_resize', await resize.count());

const before = await page.locator('body').innerText();

if (await upload.count()) {
  await upload.first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

const mid = await page.locator('body').innerText();

if (await voice.count()) {
  await voice.first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

const after = await page.locator('body').innerText();

await resize.first().hover().catch(() => {});
await page.mouse.down();
await page.mouse.move(500, 500);
await page.mouse.up();
await page.waitForTimeout(200);

console.log('content_delta_upload', mid !== before);
console.log('content_delta_voice', after !== mid);
console.log('request_count', reqs.length);
console.log('requests', reqs);

await browser.close();
