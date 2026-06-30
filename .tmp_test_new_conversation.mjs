import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const events = [];

  page.on('request', req => {
    if (req.url().includes('/api/')) events.push(`${req.method()} ${req.url()}`);
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // generate ongoing session + attachments + transfer state first
  await page.locator('textarea').first().fill('我这边还有哪些待办没处理？');
  await page.locator('button[aria-label="发送"]').click();
  await page.waitForTimeout(1400);

  // add a file using upload input if available
  const filePath = '/Users/jeremy/Documents/dify/package.json';
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
  await page.waitForTimeout(1200);

  const attachmentCountBefore = await page.locator('.ly-attachments strong').count().catch(() => 0);
  const inputTextBefore = await page.locator('textarea').inputValue();

  // trigger transfer to set manualTicket state
  const transferBtn = page.locator('.ly-transfer');
  await transferBtn.click();
  await page.waitForTimeout(500);
  const continueBtn = page.locator('.ly-service-popover button');
  await continueBtn.click();
  await page.waitForTimeout(1100);
  const transferLabelAfter = await page.locator('.ly-transfer strong').textContent().catch(() => '');

  const beforeMessages = await page.locator('.ly-message').count().catch(() => 0);

  // click new conversation in sidebar
  const newChatBtn = page.getByRole('button', { name: '新建对话' });
  await newChatBtn.click();
  await page.waitForTimeout(900);

  const afterMessages = await page.locator('.ly-message').count().catch(() => 0);
  const firstMsgText = await page.locator('.ly-message').first().textContent().catch(() => '');
  const inputTextAfter = await page.locator('textarea').inputValue();
  const attachmentCountAfter = await page.locator('.ly-attachments strong').count().catch(() => 0);
  const transferLabelAfterReset = await page.locator('.ly-transfer strong').textContent().catch(() => '');

  console.log(JSON.stringify({
    events: events.slice(-20),
    before: {
      attachmentCountBefore,
      inputTextBefore: inputTextBefore?.trim(),
      beforeMessages
    },
    transferLabelAfter: transferLabelAfter?.trim(),
    after: {
      afterMessages,
      transferLabelAfterReset: transferLabelAfterReset?.trim(),
      inputTextAfter: inputTextAfter?.trim(),
      attachmentCountAfter,
      firstMsgText: firstMsgText?.trim()
    }
  }, null, 2));

  await browser.close();
})();
