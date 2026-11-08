// Шаг 7: форма входа по голому HTTP (учебный «банк» Altoro Mutual, demo.testfire.net).
// Включённый режим «Всегда использовать безопасные соединения» блокирует переход на HTTP
// (net::ERR_BLOCKED_BY_CLIENT + предупреждение), поэтому на время теста режим выключается
// и после теста включается обратно.
import { connect, mainPage, shot } from './cdp.mjs';
import { openDevTools, highlight, clearHighlight } from './devtools.mjs';

const TEST_LOGIN = 'test_student';
const TEST_PASS = 'Test-Passw0rd!2026';

const { browser, ctx } = await connect();
for (const p of ctx.pages()) if (p.url().includes('devtools')) await p.close();
const page = await mainPage(ctx);
await page.setViewportSize({ width: 1280, height: 860 });
const LOGIN_URL = 'http://demo.testfire.net/login.jsp';
async function httpsFirst(on) {
  const sp = await ctx.newPage();   // отдельная вкладка настроек
  await sp.goto('chrome://settings/security');
  await sp.waitForTimeout(1000);
  const sw = sp.getByRole('switch', { name: 'Всегда использовать безопасные соединения' });
  if ((await sw.isChecked()) !== on) await sw.click();
  await sp.waitForTimeout(800);
  console.log('HTTPS-First:', await sw.isChecked());
  await sp.close();
  await page.bringToFront();
}
async function tryHttp() {
  try { await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 20000 }); console.log('HTTP открылся:', page.url()); return true; }
  catch (e) { console.log('HTTP заблокирован:', e.message.split('\n')[0]); await page.waitForTimeout(2000); return false; }
}
await tryHttp();                 // режим включён -> блокировка
await httpsFirst(false);         // временно выключаем
await tryHttp();
await page.waitForTimeout(1500);

const dt = await openDevTools(ctx, page, 'network', { width: 1440, height: 1000 });
await dt.getByRole('button', { name: /Очистить сетевой журнал/ }).click().catch(() => {});
await page.bringToFront();
await page.locator('#uid').fill(TEST_LOGIN);
await page.locator('#passw').fill(TEST_PASS);
await shot(page, '16-testfire-login-form.png');
await page.locator('input[name="btnSubmit"]').click();
await page.waitForTimeout(3000);
console.log('после входа:', page.url());

await dt.bringToFront();
const filter = dt.getByRole('textbox', { name: 'Фильтр' });
await filter.fill('method:POST');
await dt.waitForTimeout(800);
await dt.getByRole('row').filter({ hasText: 'doLogin' }).first().getByRole('cell').first().click();
await dt.waitForTimeout(800);
await dt.getByRole('tab', { name: 'Полезная нагрузка' }).click();
await dt.waitForTimeout(800);
await highlight(dt, [dt.getByText(TEST_PASS, { exact: true }).first()], 3);
await shot(dt, '17-login-http-payload.png');
await clearHighlight(dt);
await dt.getByRole('tab', { name: 'Заголовки' }).click();
await dt.waitForTimeout(800);
await shot(dt, '17b-login-http-headers.png');
await filter.fill('');
await dt.getByRole('tab', { name: 'Безопасность' }).click();
await dt.waitForTimeout(1500);
console.log((await dt.locator('body').innerText()).match(/(небезопасн|не защищ)[^\n]*/i)?.[0]);
await shot(dt, '18-login-http-security.png');
await dt.close();
await httpsFirst(true);          // возвращаем защиту
await tryHttp();                 // снова блокировка
await browser.close();
