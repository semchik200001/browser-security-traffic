// Шаг 1: обычный сёрфинг, чтобы в профиле накопились cookies и кэш (состояние «до»).
import { connect, mainPage, shot } from './cdp.mjs';
const { browser, ctx } = await connect();
const page = await mainPage(ctx);
await page.setViewportSize({ width: 1280, height: 860 });
for (const u of ['https://itmo.ru/', 'https://habr.com/ru/', 'https://www.rbc.ru/', 'https://lenta.ru/', 'https://ya.ru/']) {
  try { await page.goto(u, { waitUntil: 'load', timeout: 30000 }); await page.waitForTimeout(2500); console.log('ok', u); }
  catch (e) { console.log('fail', u, e.message.split('\n')[0]); }
}
const cookies = await ctx.cookies();
const domains = [...new Set(cookies.map(c => c.domain.replace(/^\./, '')))];
console.log('cookies:', cookies.length, 'domains:', domains.length);
console.log(domains.sort().join(', '));
await page.goto('chrome://settings/content/all');
await page.waitForTimeout(2000);
await shot(page, '01-site-data-before-clear.png');
await browser.close();
