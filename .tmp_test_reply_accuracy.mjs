import { chromium } from 'playwright';

async function runQuestion(question) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];

  page.on('request', req => { if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`); });
  page.on('response', res => { if (res.url().includes('/api/')) events.push(`RESP ${res.status()} ${res.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.locator('textarea').first().fill(question);
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(2200);

  const msgs = await page.locator('.ly-message').allTextContents();
  const assistantReplies = msgs.filter((x) => x.includes('小伊') || /我|建议|请先|已尝试/.test(x));

  const lastReply = (await page.locator('.ly-message').last().textContent())?.trim() || '';

  console.log(JSON.stringify({
    question,
    events,
    totalMessages: msgs,
    lastReply,
    assistantRepliesCount: assistantReplies.length,
    hasTaskTone: /确认执行|执行/.test(lastReply)
  }, null, 2));

  await browser.close();
}

await runQuestion('供应商资料提交后多久能审核完？');
