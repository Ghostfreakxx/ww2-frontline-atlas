import { test, expect } from '@playwright/test';
import { closeTracked, openPresenter, serverState } from './helpers';

test.afterEach(closeTracked);

test('PWA: manifest, icons and iOS home-screen tags', async ({ page, request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBeTruthy();
  const m = await res.json();
  expect(m.name).toBe('Frontline Atlas');
  expect(m.start_url).toBe('/presenter');
  expect(m.display).toBe('standalone');
  for (const icon of m.icons) expect((await request.get(icon.src)).ok(), icon.src).toBeTruthy();
  expect(m.icons.some((i: { purpose: string; sizes: string }) => i.purpose === 'maskable' && i.sizes === '512x512')).toBeTruthy();
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.webmanifest/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]').first()).toHaveAttribute('content', 'yes');
  const sw = await request.get('/sw.js');
  expect(sw.headers()['cache-control']).toContain('no-cache');
});

test('PWA: service worker caches the app and map, presenter opens offline, sync is never cached', async ({ browser }) => {
  const { page, code } = await openPresenter(browser);
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Reload once so the page is controlled by the worker and caches fill.
  await page.reload();
  await expect(page.locator('.conn.live')).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect.poll(async () => page.evaluate(async () => {
    const keys = await caches.keys();
    const all = (await Promise.all(keys.map(async (k) => (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname)))).flat();
    return ['/presenter', '/geo/land.json', '/geo/relief.png', '/geo/fronts.json'].every((p) => all.includes(p)) && !all.some((p) => p.startsWith('/api/'));
  }), { timeout: 15_000 }).toBe(true);
  // Offline: the presenter shell and the map still load from the cache.
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.locator('.pres-map svg').first()).toBeVisible({ timeout: 15_000 });
  await page.context().setOffline(false);
  await expect(page.locator('.conn.live')).toBeVisible({ timeout: 20_000 });
  expect(new URL(page.url()).searchParams.get('code')).toBe(code);
});

test('PWA: switch session — join by presenter link, or start a new one', async ({ browser, request }) => {
  // A session created on the computer's start page.
  const created = await (await request.post('/api/session')).json();
  const { page, code: own } = await openPresenter(browser);
  await page.getByRole('button', { name: 'Display link and QR code' }).click();
  await page.getByText('Switch session').click();
  await page.getByLabel('Presenter link').fill(`http://example.test/presenter?code=${created.code}#k=${created.token}`);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.locator('.conn.live')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => new URL(page.url()).searchParams.get('code')).toBe(created.code);
  expect(new URL(page.url()).searchParams.has('join')).toBe(false);
  // The joined session is controllable from this device.
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await serverState(request, created.code)).rev).toBeGreaterThan(1);
  // Start a new session.
  await page.goto('/presenter?new=1');
  await expect(page.locator('.conn.live')).toBeVisible({ timeout: 15_000 });
  const fresh = new URL(page.url()).searchParams.get('code');
  expect(fresh).not.toBe(created.code);
  expect(fresh).not.toBe(own);
});
