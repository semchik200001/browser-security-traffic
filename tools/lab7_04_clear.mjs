// Шаг 4: удаление cookies, кэша и истории за всё время + проверка, что данных не осталось.
import { connect, mainPage, shot } from './cdp.mjs';
const { browser, ctx } = await connect();
const page = await mainPage(ctx);
await page.setViewportSize({ width: 1280, height: 900 });
console.log('cookies до очистки:', (await ctx.cookies()).length);
await page.goto('chrome://settings/clearBrowserData');
await page.waitForTimeout(1500);
const dlg = page.getByRole('dialog');
// первая «Ещё» — показать больше типов данных, вторая — выбор периода
await page.getByRole('button', { name: 'Ещё' }).nth(1).click();
await page.waitForTimeout(700);
await page.getByRole('menuitem', { name: 'Все время' }).click();
await page.waitForTimeout(1000);
console.log((await dlg.ariaSnapshot()).split('\n').filter(l => /button .*pressed|checkbox/.test(l)).join('\n'));
await shot(page, '05-clear-browsing-data.png');
await page.getByRole('button', { name: 'Удалить с устройства' }).click();
await page.waitForTimeout(5000);
console.log('cookies после очистки:', (await ctx.cookies()).length);
await page.goto('chrome://settings/content/all');
await page.waitForTimeout(2000);
await shot(page, '06-site-data-after-clear.png');
await browser.close();
