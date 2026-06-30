import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const msgs = [];

page.on('console', msg => msgs.push(msg.text()));
page.on('pageerror', err => msgs.push('PAGE_ERROR:' + err.message));

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

const voice = page.locator('button[aria-label="语音输入"]');
console.log('voice_exists', await voice.count());

const before = await page.locator('body').innerText();
for (let i = 0; i < 2; i++) {
  await voice.first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(900);
}
const after = await page.locator('body').innerText();

const matches = [...after.matchAll(/当前环境暂时无法访问麦克风|语音|麦克风|录音/g)].map(m => m[0]);
console.log('notice_lines', matches);
console.log('text_repeats', matches.length);

console.log('snippet', after.slice(after.indexOf('点击麦克风'), after.indexOf('点击麦克风') + 120));
console.log('console_msgs_count', msgs.length);
console.log('console_msgs', msgs);

await browser.close();
