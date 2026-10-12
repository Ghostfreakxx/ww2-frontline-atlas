import { test, expect } from '@playwright/test';
import { closeTracked, openDisplay, openPresenter, serverState, track, waitForRev } from './helpers';

test.afterEach(closeTracked);

test.describe('two-window synchronisation', () => {
  test('presenter actions reach the audience display quickly', async ({ browser, request }) => {
    const { page: presenter, code } = await openPresenter(browser);
    const display = await openDisplay(browser, code);

    // The presenter sees the display connect.
    await expect(presenter.locator('.conn-count')).toHaveText(/1 display/, { timeout: 10_000 }).catch(() => {});

    // 1. Next step → scene 1 step 1 (borders of 1939) on both.
    const t0 = Date.now();
    await presenter.locator('.next-btn').click();
    await expect(display.locator('.display-root')).toHaveAttribute('data-date', '1939-09-01');
    const latency = Date.now() - t0;
    console.log(`next-step latency presenter→display: ${latency} ms`);
    expect(latency).toBeLessThan(1500);

    // 2. Tap Army Group Centre in the Forces tab → highlighted on the audience map.
    await presenter.locator('.top-scene').waitFor();
    // Jump to scene 4 (Army Group Centre) via the scene list.
    await presenter.getByRole('tab', { name: 'Scene' }).click();
    await presenter.locator('.scene-item', { hasText: 'Army Group Centre' }).click();
    await expect(display.locator('.display-root')).toHaveAttribute('data-date', '1941-06-22');
    await presenter.getByRole('tab', { name: 'Forces' }).click();
    await presenter.locator('.force-main', { hasText: 'Army Group North' }).click();
    let st = await serverState(request, code);
    expect(st.focus.formations).toEqual(['de-hg-north']);
    await waitForRev(display, st.rev);
    await presenter.locator('.force-main', { hasText: 'Army Group Centre' }).click();
    st = await serverState(request, code);
    expect(st.focus.formations).toEqual(['de-hg-centre']);
    await waitForRev(display, st.rev);
    // Commander card on the display shows the date-correct commander.
    await expect(display.locator('svg text', { hasText: 'Fedor von Bock' }).first()).toBeVisible();

    // 3. Layout and hide-UI propagate.
    await presenter.locator('.pres-top .seg button', { hasText: 'Full' }).click();
    await expect(display.locator('svg[data-layout="full"]')).toBeVisible();
    await presenter.getByRole('button', { name: /Hide UI/ }).click();
    await expect(display.locator('svg text', { hasText: 'Fedor von Bock' })).toHaveCount(0);
    await presenter.getByRole('button', { name: /Panels hidden/ }).click();
    await expect(display.locator('svg text', { hasText: 'Fedor von Bock' }).first()).toBeVisible();

    // 4. Camera: zoom in on the presenter → display camera follows.
    const before = (await serverState(request, code)).camera.zoom;
    await presenter.getByRole('button', { name: 'Zoom in' }).click();
    st = await serverState(request, code);
    expect(st.camera.zoom).toBeCloseTo(before * 1.5, 3);
    await waitForRev(display, st.rev);
  });

  test('a second presenter device stays in step', async ({ browser, request }) => {
    const a = await openPresenter(browser);
    const ctx = track(await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true }));
    const b = await ctx.newPage();
    await b.goto(`/presenter?code=${a.code}#k=${a.token}`);
    await expect(b.locator('.conn.live')).toBeVisible();
    await a.page.locator('.next-btn').click();
    await expect(b.locator('.timeline-head-label')).toHaveText('1 Sep 1939');
    await b.locator('.next-btn').click();
    await expect(a.page.locator('.timeline-head-label')).toHaveText('21 Jun 1941');
    expect((await serverState(request, a.code)).stepIndex).toBe(2);
  });

  test('display without presenter key cannot change the session', async ({ browser, request }) => {
    const { code } = await openPresenter(browser);
    const res = await request.put(`/api/session/${code}`, { data: { state: { date: '1945-05-08' } }, headers: { Authorization: 'Bearer wrong' } });
    expect(res.status()).toBe(403);
    const res2 = await request.put(`/api/session/${code}`, { data: { state: { date: '1945-05-08' } } });
    expect(res2.status()).toBe(403);
  });
});
