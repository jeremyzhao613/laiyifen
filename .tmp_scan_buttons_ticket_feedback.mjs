import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(1200);

const b1 = page.getByRole('button', { name: '工单列表' });
console.log('ticket_list_btn_count', await b1.count());
await b1.click();
await page.waitForTimeout(1200);

const texts = await page.locator('button').allTextContents();
console.log('button_texts', texts.map((s,i)=>`${i}:${JSON.stringify(s)}`));

const body = await page.locator('body').innerText();
console.log('body_has_return', body.includes('返回对话'));

await page.locator('button', { hasText: '返回对话' }).first().click({ timeout: 5000 }).catch((e)=>{console.log('click_err', String(e.message));});
await page.waitForTimeout(500);
console.log('after_click_body_has_input', (await page.locator('body').innerText()).includes('请输入您的问题'));

await page.close();
await browser.close();
