import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: '工单列表' }).click();
await page.waitForTimeout(800);

const before = await page.locator('body').innerText();
await page.locator('button', { hasText: '返回对话' }).click();
await page.waitForTimeout(900);
const after = await page.locator('body').innerText();

console.log('before_lines', before.slice(0,400));
console.log('after_lines', after.slice(0,500));
console.log('same', before===after);

const hasGreeting = /你好，我是小伊/.test(after);
const hasTicketSection = /工单反馈|工单列表|TK-/.test(after);
const hasQuick = /快捷提问|给我看一下后台数据|换一换/.test(after);

console.log('hasGreeting', hasGreeting);
console.log('hasTicketSection', hasTicketSection);
console.log('hasQuick', hasQuick);

await browser.close();
