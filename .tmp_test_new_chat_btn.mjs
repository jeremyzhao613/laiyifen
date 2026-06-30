import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const reqs = [];
page.on('request', req => { const u = req.url(); if (u.includes('/api/')) reqs.push(u); });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(900);

// Enter history list
await page.getByRole('button', { name: '历史对话' }).click();
await page.waitForTimeout(900);

const beforeText = await page.locator('body').innerText();
const hasHistory = /历史对话/.test(beforeText) && /当前查看/.test(beforeText);

// Click new chat
await page.getByRole('button', { name: '新建对话' }).click();
await page.waitForTimeout(1000);
const afterText = await page.locator('body').innerText();

const backToHome = /你好，我是小伊/.test(afterText) && /匹配结果/.test(afterText) === false;
const stillInHistory = /当前查看/.test(afterText) || /匹配结果/.test(afterText);

console.log('entered_history', hasHistory);
console.log('after_has_welcome', /你好，我是小伊/.test(afterText));
console.log('after_still_in_history', stillInHistory);
console.log('back_to_home_guess', backToHome);
console.log('api_sample', reqs.slice(-10));

await browser.close();
