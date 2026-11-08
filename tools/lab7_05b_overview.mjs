// Шаг 5b: обзорный скрин вкладки «Сеть» с рамками (GET-документ и POST аналитики).
import { connect, shot } from './cdp.mjs';
import { highlight, clearHighlight } from './devtools.mjs';
const { browser, ctx } = await connect();
const dt = ctx.pages().find(p => p.url().includes('devtools'));
await dt.bringToFront();
await dt.setViewportSize({ width: 1440, height: 900 });
await dt.getByRole('tab', { name: 'Сеть' }).click();
await dt.waitForTimeout(600);
const close = dt.getByRole('button', { name: 'Закрыть' }).first();
if (await close.isVisible().catch(() => false)) await close.click();
await dt.getByRole('textbox', { name: 'Фильтр' }).fill('');
await dt.waitForTimeout(800);
await dt.mouse.move(700, 500);
for (let i = 0; i < 5; i++) { await dt.mouse.wheel(0, -20000); await dt.waitForTimeout(400); }
await dt.waitForTimeout(1500);
const rows = dt.getByRole('row');
const post = rows.filter({ hasText: 'mc.yandex.com' }).first();
const get = rows.filter({ hasText: /^itmo\.ru/ }).first();
const hdr = dt.getByRole('columnheader', { name: /^Метод/ });
for (const [n, l] of [['hdr', hdr], ['post', post], ['get', get]]) console.log(n, await l.boundingBox());
await highlight(dt, [hdr, post, get], 0);
await dt.waitForTimeout(300);
await shot(dt, '08-network-overview.png');
await clearHighlight(dt);
await browser.close();
