import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const msgs = [];

page.on('request', req => {
  if (req.url().includes('/api/chat/') && req.method()==='POST') {
    msgs.push({ url: req.url(), body: req.postData() || '' });
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

await page.getByRole('textbox').fill('第一条供应商身份');
await page.getByRole('button',{name:'发送'}).click();
await page.waitForTimeout(1100);

await page.locator('select').first().selectOption('加盟商');
await page.getByRole('textbox').fill('第二条加盟商身份');
await page.getByRole('button',{name:'发送'}).click();
await page.waitForTimeout(1200);

console.log('count', msgs.length);
const parsed = msgs.map(m=>{ if(!m.body) return m; try {return {...m, json: JSON.parse(m.body)} } catch { return m; }});
console.log(JSON.stringify(parsed, null, 2));

await browser.close();
