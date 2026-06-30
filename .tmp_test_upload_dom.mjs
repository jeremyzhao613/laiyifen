import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const uploadBtn = page.locator('button[aria-label="上传图片/文件"]');
const btnInfo = await uploadBtn.evaluate((btn) => ({
  tag: btn.tagName,
  cls: btn.className,
  type: btn.getAttribute('type'),
  aria: btn.getAttribute('aria-label'),
  nextInput: !!btn.querySelector('input'),
  nextSiblingInput: !!(btn.nextElementSibling && btn.nextElementSibling.tagName === 'INPUT'),
  parent: btn.parentElement ? btn.parentElement.tagName : null,
}));

const hiddenInput = page.locator('input[type="file"]');
console.log('hidden_input_count', await hiddenInput.count());
if (await hiddenInput.count()) {
  const all = [];
  for (let i = 0; i < Math.min(await hiddenInput.count(), 8); i++) {
    const inp = hiddenInput.nth(i);
    all.push({
      i,
      id: await inp.getAttribute('id'),
      name: await inp.getAttribute('name'),
      cls: await inp.getAttribute('class'),
      display: await inp.evaluate((el) => el.style.display || ''),
      hidden: await inp.evaluate((el) => el.hidden),
      accept: await inp.getAttribute('accept'),
      multiple: await inp.getAttribute('multiple'),
    });
  }
  console.log('input_file_list', all);
}

console.log('uploadBtnInfo', btnInfo);

await browser.close();
