// Шаг 2: Безопасный просмотр, HTTPS-First, безопасный DNS.
import { connect, mainPage, shot } from './cdp.mjs';
const { browser, ctx } = await connect();
const page = await mainPage(ctx);
await page.setViewportSize({ width: 1280, height: 1000 });
await page.goto('chrome://settings/security');
await page.waitForTimeout(1200);
await page.getByRole('radio', { name: 'Улучшенная защита' }).click();
await page.waitForTimeout(800);
const https = page.getByRole('switch', { name: 'Всегда использовать безопасные соединения' });
if ((await https.getAttribute('aria-pressed')) !== 'true' && !(await https.isChecked().catch(() => false))) await https.click();
await page.waitForTimeout(800);
await page.getByRole('combobox', { name: 'Выбрать поставщика услуг DNS' }).selectOption({ label: 'Cloudflare (1.1.1.1)' });
await page.waitForTimeout(1200);
console.log((await page.locator('body').ariaSnapshot()).split('\n').filter(l => /radio|switch|option .*selected|combobox/.test(l)).join('\n'));
await shot(page, '02-security-settings.png');
await browser.close();
