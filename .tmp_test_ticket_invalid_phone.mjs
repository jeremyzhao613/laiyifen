import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];

page.on('response', (resp) => {
  const url = resp.url();
  if (url.includes('/api/tickets')) {
    reqs.push({ status: resp.status(), method: resp.request().method(), url });
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

await page.getByRole('button', { name: '工单反馈' }).click();
await page.waitForTimeout(900);

const label = page.locator('text=反馈内容').first();
if (await label.count() === 0) {
  const any = await page.locator('text=反馈表单').first().count();
  console.log('feedback_form_visible', any > 0);
}

// fill fields
const typeBtn = page.locator('select, option, [role="combobox"]').first();

// try generic fill by labels
await page.getByPlaceholder('请选择反馈类型').click().catch(async()=>{});
await page.waitForTimeout(200);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter').catch(()=>{});
await page.getByPlaceholder('请输入问题反馈').fill('这是无效手机号回归测试');
await page.getByPlaceholder('请输入反馈人姓名').fill('测试人员');
await page.getByPlaceholder('请输入手机号').fill('abcd1234');
await page.waitForTimeout(200);

const submit = page.locator('button', { hasText: /^提交$/ }).first();
console.log('submit_exists', await submit.count() > 0);
await submit.click();
await page.waitForTimeout(1200);

const body = await page.locator('body').innerText();
console.log('contains_notice', /反馈码|提交|工单|成功|提交失败|手机号|格式|请/.test(body));
console.log('contains_success', /已提交工单/.test(body));
console.log('contains_error', /手机号|格式|不正确|失败|请先/.test(body));
console.log('ticket_api', reqs);

await browser.close();
