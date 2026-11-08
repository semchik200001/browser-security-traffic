// Шаг 3: блок сторонних cookies + Do Not Track; менеджер паролей Chrome отключён.
import { connect, mainPage, shot } from './cdp.mjs';
const { browser, ctx } = await connect();
const page = await mainPage(ctx);
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto('chrome://settings/cookies');
await page.waitForTimeout(1200);
await page.getByRole('radio', { name: 'Блокировать сторонние файлы cookie' }).click();
await page.waitForTimeout(600);
const dnt = page.getByRole('switch', { name: 'Отправлять Do Not Track в запросах веб-страниц' });
if (!(await dnt.isChecked())) {
  await dnt.click();
  await page.waitForTimeout(800);
  const confirm = page.getByRole('button', { name: /Подтвердить|Да|ОК|OK/ });
  if (await confirm.count()) { await confirm.first().click(); console.log('DNT dialog confirmed'); }
}
await page.waitForTimeout(800);
// раскрытое описание «Разрешить» свернём, чтобы влезли все переключатели
console.log((await page.locator('body').ariaSnapshot()).split('\n').filter(l => /radio|switch/.test(l)).join('\n'));
await shot(page, '03-cookies-settings.png');

await page.goto('chrome://password-manager/settings');
await page.waitForTimeout(1500);
for (const name of [/^Предлагать сохранение паролей/, /^Автоматический вход/, /^Автоматически создавать ключи доступа/]) {
  const sw = page.getByRole('switch', { name });
  if (await sw.count() && await sw.isChecked()) await sw.click();
  await page.waitForTimeout(500);
}
console.log((await page.locator('body').ariaSnapshot()).split('\n').filter(l => /switch/.test(l)).join('\n'));
await shot(page, '04-password-manager-settings.png');
await browser.close();
