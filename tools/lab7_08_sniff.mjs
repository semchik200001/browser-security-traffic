// Шаг 8: тот же вход, но трафик идёт через «подслушивающий» прокси (tools/sniff_proxy.py).
// Отдельный контекст браузера с прокси 127.0.0.1:8899, основной профиль не трогаем.
import { connect } from './cdp.mjs';

const PASS = 'Test-Passw0rd!2026';
const { browser, ctx } = await connect();

async function httpsFirst(on) {
  const sp = await ctx.newPage();
  await sp.goto('chrome://settings/security');
  await sp.waitForTimeout(1000);
  const sw = sp.getByRole('switch', { name: 'Всегда использовать безопасные соединения' });
  if ((await sw.isChecked()) !== on) await sw.click();
  await sp.waitForTimeout(800);
  console.log('HTTPS-First:', await sw.isChecked());
  await sp.close();
}

const spy = await browser.newContext({ proxy: { server: 'http://127.0.0.1:8899' }, viewport: { width: 1280, height: 860 } });
const p = await spy.newPage();

// 1) HTTP: demo.testfire.net
let ok = await p.goto('http://demo.testfire.net/login.jsp', { waitUntil: 'domcontentloaded' }).then(() => true).catch(e => { console.log('blocked:', e.message.split('\n')[0]); return false; });
if (!ok) {
  await p.waitForTimeout(2000);
  await httpsFirst(false);
  await p.goto('http://demo.testfire.net/login.jsp', { waitUntil: 'domcontentloaded' });
}
await p.locator('#uid').fill('test_student');
await p.locator('#passw').fill(PASS);
await p.locator('input[name="btnSubmit"]').click();
await p.waitForTimeout(3000);
console.log('HTTP done:', p.url());
if (!ok) await httpsFirst(true);

// 2) HTTPS: demo.owasp-juice.shop
await p.goto('https://demo.owasp-juice.shop/#/login', { waitUntil: 'domcontentloaded' });
for (const name of [/Close Welcome Banner|Dismiss/i, /dismiss cookie message|Me want it/i]) {
  const b = p.getByRole('button', { name }).first();
  await b.waitFor({ state: 'visible', timeout: 30000 }).then(() => b.click()).catch(() => {});
  await p.waitForTimeout(500);
}
await p.locator('#email').fill('test.student@example.com');
await p.locator('#password').fill(PASS);
await p.locator('#loginButton').evaluate(b => b.click());  // клик через DOM: оверлей баннера не мешает
await p.waitForTimeout(4000);
console.log('HTTPS done:', await p.getByText(/Invalid email or password/).count() ? 'Invalid email or password' : p.url());
await spy.close();
await browser.close();
