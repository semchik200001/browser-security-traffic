// Шаг 6: форма входа по HTTPS (учебный OWASP Juice Shop), тестовые данные.
// Смотрим в DevTools, как уходят логин и пароль, и чем защищено соединение.
import { connect, mainPage, shot } from './cdp.mjs';
import { openDevTools, highlight, clearHighlight } from './devtools.mjs';

export const TEST_LOGIN = 'test.student@example.com';
export const TEST_PASS = 'Test-Passw0rd!2026';

const { browser, ctx } = await connect();
for (const p of ctx.pages()) if (p.url().includes('devtools')) await p.close();
const page = await mainPage(ctx);
await page.setViewportSize({ width: 1280, height: 860 });
await page.goto('https://demo.owasp-juice.shop/#/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
// закрыть приветственное окно и баннер cookies (появляются с задержкой)
for (const name of [/Close Welcome Banner|Dismiss/i, /dismiss cookie message|Me want it/i]) {
  const b = page.getByRole('button', { name }).first();
  await b.waitFor({ state: 'visible', timeout: 15000 }).then(() => b.click()).catch(() => console.log('нет кнопки', name));
  await page.waitForTimeout(700);
}
const dt = await openDevTools(ctx, page, 'network', { width: 1440, height: 1000 });
await dt.getByRole('button', { name: /Очистить сетевой журнал/ }).click();
await page.bringToFront();
await page.locator('#email').fill(TEST_LOGIN);
await page.locator('#password').fill(TEST_PASS);
await page.waitForTimeout(500);
await shot(page, '12-juice-login-form.png');
await page.locator('#loginButton').click();
await page.waitForTimeout(3000);
await shot(page, '12b-juice-login-result.png');

await dt.bringToFront();
const filter = dt.getByRole('textbox', { name: 'Фильтр' });
await filter.fill('method:POST');
await dt.waitForTimeout(800);
const row = dt.getByRole('row').filter({ hasText: 'login' }).first();
await row.getByRole('cell').first().click();
await dt.waitForTimeout(800);
await dt.getByRole('tab', { name: 'Полезная нагрузка' }).click();
await dt.waitForTimeout(800);
const pw = dt.getByText(TEST_PASS, { exact: false }).first();
await highlight(dt, [pw], 3);
await shot(dt, '13-login-https-payload.png');
await clearHighlight(dt);
await dt.getByRole('tab', { name: 'Заголовки' }).click();
await dt.waitForTimeout(800);
await shot(dt, '13b-login-https-headers.png');
await filter.fill('');

await dt.getByRole('tab', { name: 'Безопасность' }).click();
await dt.waitForTimeout(1500);
console.log((await dt.locator('body').innerText()).match(/Подключение к сайту[^\n]*/)?.[0]);
await shot(dt, '14-login-https-security.png');
await browser.close();
