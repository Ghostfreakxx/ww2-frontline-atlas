import { test, expect } from '@playwright/test';
import { closeTracked, openDisplay, openPresenter, serverState, track, waitForRev } from './helpers';

test.afterEach(closeTracked);

test.describe('reconnection and session recovery', () => {
  test('display reconnects and catches up after a network drop', async ({ browser, request }) => {
    const { page: presenter, code } = await openPresenter(browser);
    const display = await openDisplay(browser, code);
    await display.context().setOffline(true);
    // An open SSE stream survives offline emulation, so also drop it the way a Wi-Fi loss would.
    await display.evaluate(() => window.dispatchEvent(new Event('atlas-debug-drop')));
    // While the display is offline the presenter keeps working.
    await presenter.locator('.next-btn').click();
    await presenter.locator('.next-btn').click();
    const st = await serverState(request, code);
    expect(st.date).toBe('1941-06-21');
    await expect(display.locator('.conn-pill')).toBeVisible({ timeout: 10_000 });
    await display.context().setOffline(false);
    await waitForRev(display, st.rev, 20_000);
    await expect(display.locator('.display-root')).toHaveAttribute('data-date', '1941-06-21');
    await expect(display.locator('.conn-pill')).toHaveCount(0);
  });

  test('presenter reload resumes the same session and scene', async ({ browser, request }) => {
    const { page: presenter, code } = await openPresenter(browser);
    await presenter.locator('.scene-item', { hasText: 'Army Group South' }).click();
    await presenter.locator('.next-btn').click();
    const before = await serverState(request, code);
    await presenter.reload();
    await expect(presenter.locator('.conn.live')).toBeVisible();
    await expect(presenter.locator('.conn-code')).toHaveText(code);
    await expect(presenter.locator('.top-scene')).toContainText('Army Group South');
    await expect(presenter.locator('.top-scene')).toContainText('step 1/4');
    const after = await serverState(request, code);
    expect(after.sceneId).toBe(before.sceneId);
    expect(after.date).toBe(before.date);
  });

  test('display waits for a session that does not exist yet', async ({ browser }) => {
    const ctx = track(await browser.newContext());
    const page = await ctx.newPage();
    await page.goto('/display?code=ZZZZZZ');
    await expect(page.getByText(/not found/)).toBeVisible();
  });
});
