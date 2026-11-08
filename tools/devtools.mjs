// Открывает панель DevTools (тот же фронтенд, что по F12), подключённую к вкладке `page`,
// в отдельной вкладке — так её можно снимать и кликать автоматически.
export async function openDevTools(ctx, page, panel = 'network', viewport = { width: 1440, height: 900 }) {
  const s = await ctx.newCDPSession(page);
  const { targetInfo } = await s.send('Target.getTargetInfo');
  await s.detach();
  // Chrome 14x+ (Local Network Access): публичному origin фронтенда нужно разрешение
  // на подключение к 127.0.0.1, иначе WebSocket к порту отладки блокируется.
  const bs = await ctx.browser().newBrowserCDPSession();
  for (const name of ['local-network-access', 'local-network', 'loopback-network'])
    await bs.send('Browser.setPermission', { permission: { name }, setting: 'granted',
      origin: 'https://chrome-devtools-frontend.appspot.com' }).catch(() => {});
  const dt = await ctx.newPage();
  await dt.setViewportSize(viewport);
  // Фронтенд той же ревизии, что у браузера, с серверов Google: в нём есть русская локализация
  // (встроенный в порт отладки фронтенд отдаёт пустые файлы локалей).
  const v = await (await fetch('http://127.0.0.1:9333/json/version')).json();
  const rev = v['WebKit-Version'].match(/@([0-9a-f]+)/)[1];
  await dt.goto(`https://chrome-devtools-frontend.appspot.com/serve_rev/@${rev}/inspector.html?ws=127.0.0.1:9333/devtools/page/${targetInfo.targetId}&panel=${panel}`);
  await dt.waitForTimeout(1500);
  // русский интерфейс, без инфобара и без screencast-превью страницы
  await dt.evaluate(() => {
    localStorage.setItem('language', '"ru"');
    localStorage.setItem('disable-locale-info-bar', 'true');
    localStorage.setItem('screencast-enabled', 'false');
    localStorage.setItem('screencastEnabled', 'false');
  });
  await dt.reload();
  await dt.waitForTimeout(2500);
  const sc = dt.getByRole('button', { name: /скринкаст/i });
  if (await sc.count() && (await sc.first().getAttribute('aria-pressed')) === 'true') { await sc.first().click(); await dt.waitForTimeout(500); }
  return dt;
}

// Добавить колонки в таблицу запросов (контекстное меню заголовка).
export async function addColumns(dt, cols) {
  for (const col of cols) {
    await dt.getByRole('columnheader').first().click({ button: 'right' });
    await dt.waitForTimeout(400);
    const item = dt.getByRole('menuitem', { name: `${col}, не выбрано` });
    if (await item.count()) await item.click(); else await dt.keyboard.press('Escape');
    await dt.waitForTimeout(300);
  }
}

// Красные рамки поверх интерфейса (выделение на скриншоте) и их удаление.
export async function highlight(dt, locators, pad = 2) {
  const rects = [];
  for (const l of locators) { const b = await l.boundingBox(); if (b) rects.push(b); }
  await dt.evaluate(({ rects, pad }) => {
    for (const r of rects) {
      const d = document.createElement('div');
      d.className = '__lab7_hl';
      Object.assign(d.style, { position: 'fixed', left: `${r.x - pad}px`, top: `${r.y - pad}px`,
        width: `${r.width + 2 * pad}px`, height: `${r.height + 2 * pad}px`, border: '3px solid #e01b24',
        borderRadius: '4px', zIndex: 2147483647, pointerEvents: 'none', boxSizing: 'border-box' });
      document.body.appendChild(d);
    }
  }, { rects, pad });
}
export async function clearHighlight(dt) {
  await dt.evaluate(() => document.querySelectorAll('.__lab7_hl').forEach(e => e.remove()));
}
