import { expect, type Browser, type Page, type APIRequestContext } from '@playwright/test';

export const IPAD_LANDSCAPE = { width: 1180, height: 820 };
export const IPAD_PORTRAIT = { width: 820, height: 1180 };

/** Open the presenter on an iPad-sized touch context; returns the page and its session code/token. */
export async function openPresenter(browser: Browser, viewport = IPAD_LANDSCAPE) {
  const ctx = await browser.newContext({ viewport, hasTouch: true, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const page = await ctx.newPage();
  await page.goto('/presenter');
  await expect(page.locator('.conn.live')).toBeVisible({ timeout: 15_000 });
  const code = new URL(page.url()).searchParams.get('code')!;
  const token = await page.evaluate((c) => localStorage.getItem(`atlas.token.${c}`), code);
  // Wait for the demonstration episode to load.
  await expect(page.locator('.top-episode')).toHaveText(/Barbarossa/);
  return { page, code, token: token! };
}

export async function openDisplay(browser: Browser, code: string, query = '') {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(`/display?code=${code}${query}`);
  await expect(page.locator('.display-root[data-status="live"] svg').first()).toBeVisible({ timeout: 15_000 });
  return page;
}

export async function serverState(request: APIRequestContext, code: string) {
  const res = await request.get(`/api/session/${code}`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()).state;
}

/** Wait until the display has rendered at least `rev`. */
export async function waitForRev(display: Page, rev: number, timeout = 5000) {
  await expect.poll(async () => Number(await display.locator('.display-root').getAttribute('data-rev')), { timeout }).toBeGreaterThanOrEqual(rev);
}
