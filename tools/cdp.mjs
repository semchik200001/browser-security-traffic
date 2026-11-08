// Подключение к отдельному профилю Chrome лабы 7 (tools/launch_lab_chrome.sh, порт 9333).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SHOTS = path.join(ROOT, 'docs', 'screenshots');

export async function connect() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = browser.contexts()[0];
  return { browser, ctx };
}

// Первая обычная вкладка (или новая, если открытых нет).
export async function mainPage(ctx) {
  const pages = ctx.pages().filter(p => !/devtools/.test(p.url()));
  return pages[0] ?? await ctx.newPage();
}

export async function shot(page, name, opts = {}) {
  const file = path.join(SHOTS, name);
  await page.screenshot({ path: file, ...opts });
  console.log('screenshot:', file);
  return file;
}
