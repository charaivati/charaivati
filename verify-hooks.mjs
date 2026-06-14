import { chromium } from 'playwright';

const errors = [];
const consoleMsgs = [];

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

page.on('console', (msg) => {
  consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => {
  errors.push('PAGEERROR: ' + err.message);
});

// Create guest session
const res = await page.request.post('http://127.0.0.1:3000/api/user/guest');
console.log('guest create status', res.status());

// Visit /self
await page.goto('http://127.0.0.1:3000/self', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

console.log('--- After /self load ---');
console.log('Errors so far:', JSON.stringify(errors, null, 2));

// Close any open menu first
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Click the floating chat bubble at bottom-right (round indigo button)
await page.mouse.click(1228, 612);
console.log('clicked chat bubble');
await page.waitForTimeout(1000);

console.log('--- After opening widget ---');
console.log('Errors so far:', JSON.stringify(errors, null, 2));

// Try sending a message
const textarea = page.locator('textarea').first();
if (await textarea.count() > 0) {
  await textarea.fill('Hello, tell me about my goals');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(40000);
}

console.log('--- After sending message ---');
console.log('Errors so far:', JSON.stringify(errors, null, 2));
await page.screenshot({ path: 'verify-hooks-widget-open.png', fullPage: false });

// Navigate to /listen and back
await page.goto('http://127.0.0.1:3000/listen', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
console.log('--- After /listen ---');
console.log('Errors so far:', JSON.stringify(errors, null, 2));

await page.goto('http://127.0.0.1:3000/self', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
console.log('--- After back to /self ---');
console.log('Errors so far:', JSON.stringify(errors, null, 2));

// Take screenshot
await page.screenshot({ path: 'verify-hooks-screenshot.png', fullPage: false });

console.log('=== ALL CONSOLE MESSAGES ===');
console.log(consoleMsgs.join('\n'));

await browser.close();
