// Шаг 5: анализ HTTP-запросов itmo.ru во вкладке «Сеть» DevTools.
import { connect, mainPage, shot } from './cdp.mjs';
import { openDevTools, addColumns, highlight, clearHighlight } from './devtools.mjs';

const SITE = 'https://itmo.ru/';
const { browser, ctx } = await connect();
for (const p of ctx.pages()) if (p.url().includes('devtools')) await p.close();
const page = await mainPage(ctx);
await page.setViewportSize({ width: 1280, height: 860 });
await page.goto(SITE, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(3000);
await shot(page, '07-itmo-page.png');

const dt = await openDevTools(ctx, page, 'network', { width: 1440, height: 900 });
await addColumns(dt, ['Метод', 'Домен', 'Протокол']);
const noCache = dt.getByRole('checkbox', { name: 'Отключить кеш' });
if (!(await noCache.isChecked())) await noCache.check();
await dt.getByRole('button', { name: /Очистить сетевой журнал/ }).click();
await page.bringToFront();
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
// ждём, пока страница догрузится и счётчики аналитики отправят POST (фоновую вкладку Chrome тормозит)
const filter = dt.getByRole('textbox', { name: 'Фильтр' });
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(3000);
  await filter.fill('method:POST');
  const n = (await dt.getByRole('row').count()) - 1;
  await filter.fill('');
  console.log(`t=${(i + 1) * 3}s POST=${n}`);
  if (n >= 2) break;
}
await page.waitForTimeout(3000);
await dt.bringToFront();
await dt.waitForTimeout(800);

// 1) Общий список: сортировка по методу (POST сверху), выделены POST и GET.
const methodHeader = dt.getByRole('columnheader', { name: /^Метод/ });
await methodHeader.click(); await dt.waitForTimeout(400);
await methodHeader.click(); await dt.waitForTimeout(800);
await dt.mouse.move(700, 600); await dt.mouse.wheel(0, -100000); await dt.waitForTimeout(800);
const rows = dt.getByRole('row');
const post = rows.filter({ hasText: 'mc.yandex.com' }).first();
const get = rows.filter({ hasText: /^itmo\.ru/ }).first();
await highlight(dt, [methodHeader, post, get]);
await shot(dt, '08-network-overview.png');
await clearHighlight(dt);

// 2) GET: документ itmo.ru, вкладка «Заголовки».
await dt.setViewportSize({ width: 1440, height: 1500 });
await filter.fill('mime-type:text/html domain:itmo.ru');
await dt.waitForTimeout(800);
await rows.filter({ hasText: /^itmo\.ru/ }).first().getByRole('cell').first().click();
await dt.waitForTimeout(800);
await dt.getByRole('tab', { name: 'Заголовки' }).click();
await dt.waitForTimeout(800);
await shot(dt, '09-network-get-headers.png');

// 3) POST: Яндекс Метрика, вкладка «Полезная нагрузка».
await filter.fill('method:POST domain:mc.yandex.com');
await dt.waitForTimeout(800);
await rows.filter({ hasText: 'POST' }).first().getByRole('cell').first().click();
await dt.waitForTimeout(800);
await dt.getByRole('tab', { name: 'Полезная нагрузка' }).click();
await dt.waitForTimeout(800);
await shot(dt, '10-network-post-payload.png');
await dt.getByRole('tab', { name: 'Заголовки' }).click();
await dt.waitForTimeout(600);
await shot(dt, '10b-network-post-headers.png');
await filter.fill('');

// 4) Вкладка «Безопасность»: TLS-подключение itmo.ru.
await dt.setViewportSize({ width: 1440, height: 900 });
await dt.getByRole('tab', { name: 'Безопасность' }).click();
await dt.waitForTimeout(1500);
console.log((await dt.locator('body').ariaSnapshot()).split('\n').filter(l => /TLS|QUIC|X25519|AES|сертифик|Подключ/i.test(l)).slice(0, 20).join('\n'));
await shot(dt, '11-security-panel-itmo.png');
await browser.close();
