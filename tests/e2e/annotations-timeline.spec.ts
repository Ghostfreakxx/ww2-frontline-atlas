import { test, expect } from '@playwright/test';
import { openDisplay, openPresenter, serverState, waitForRev } from './helpers';
import { frameRect, transformFor, toScreen } from '../../src/lib/map/camera';
import { project } from '../../src/lib/map/projection';
import { LAYOUTS } from '../../src/lib/sync/state';

const MOSCOW: [number, number] = [37.62, 55.75];

test.describe('annotations', () => {
  test('a circle drawn on the iPad lands on the same place on the audience display', async ({ browser, request }) => {
    const { page: presenter, code } = await openPresenter(browser);
    const display = await openDisplay(browser, code, '&clean=1');
    // Go to the Moscow scene so Moscow is in view.
    await presenter.locator('.scene-item', { hasText: 'Battle of Moscow' }).click();
    await presenter.waitForTimeout(2600); // camera flight
    const st = await serverState(request, code);
    const box = (await presenter.locator('.pres-map').boundingBox())!;
    const L = LAYOUTS[st.layout as keyof typeof LAYOUTS].map;
    const frame = frameRect(box.width, box.height, L.w / L.h, 14);
    const t = transformFor(st.camera, { w: box.width, h: box.height, frameH: frame.h });
    const [mx, my] = toScreen(t, project(MOSCOW));
    // Draw a circle centred on Moscow with radius 40 px.
    await presenter.getByRole('button', { name: 'Circle' }).click();
    await presenter.mouse.move(box.x + mx, box.y + my);
    await presenter.mouse.down();
    await presenter.mouse.move(box.x + mx + 20, box.y + my, { steps: 3 });
    await presenter.mouse.move(box.x + mx + 40, box.y + my, { steps: 3 });
    await presenter.mouse.up();
    const after = await serverState(request, code);
    expect(after.annotations).toHaveLength(1);
    const [lon, lat] = after.annotations[0].points[0];
    expect(Math.abs(lon - MOSCOW[0])).toBeLessThan(0.05);
    expect(Math.abs(lat - MOSCOW[1])).toBeLessThan(0.05);
    await waitForRev(display, after.rev);
    // On the display the circle centre must be at Moscow's display position (map region of the layout).
    const dt = transformFor(after.camera, { w: L.w, h: L.h, frameH: L.h });
    const [dx, dy] = toScreen(dt, project(MOSCOW));
    await display.waitForTimeout(400);
    const circle = display.locator('svg svg circle[fill="none"][stroke="#b3261e"]').first();
    const cx = Number(await circle.getAttribute('cx'));
    const cy = Number(await circle.getAttribute('cy'));
    console.log(`annotation centre on display: (${cx.toFixed(1)}, ${cy.toFixed(1)}) expected (${dx.toFixed(1)}, ${dy.toFixed(1)})`);
    expect(Math.abs(cx - dx)).toBeLessThan(3);
    expect(Math.abs(cy - dy)).toBeLessThan(3);

    // Undo, redo, clear.
    await presenter.getByRole('button', { name: 'Undo' }).click();
    expect((await serverState(request, code)).annotations).toHaveLength(0);
    await presenter.getByRole('button', { name: 'Redo' }).click();
    expect((await serverState(request, code)).annotations).toHaveLength(1);
    await presenter.getByRole('button', { name: 'Clear drawings' }).click();
    expect((await serverState(request, code)).annotations).toHaveLength(0);
  });
});

test.describe('timeline correctness', () => {
  test('front line shown is the latest documented snapshot, never interpolated', async ({ browser, request }) => {
    const { page: presenter, code, token } = await openPresenter(browser);
    const display = await openDisplay(browser, code);
    const st = await serverState(request, code);
    const cases: [string, string][] = [
      ['1941-06-22', 'Front line on this date'],
      ['1941-07-01', 'Front line as of 22 Jun 1941'],
      ['1941-08-24', 'Front line as of 9 Jul 1941'],
      ['1941-10-15', 'Front line as of 30 Sep 1941'],
      ['1941-12-05', 'Front line on this date'],
    ];
    for (const [date, label] of cases) {
      const res = await request.put(`/api/session/${code}`, { data: { state: { ...st, date, panels: { ...st.panels, date: true }, layers: { ...st.layers, front: true }, playback: { ...st.playback, playing: false } } }, headers: { Authorization: `Bearer ${token}` } });
      expect(res.ok()).toBeTruthy();
      await expect(display.locator('.display-root')).toHaveAttribute('data-date', date);
      await expect(display.locator('svg text', { hasText: label })).toBeVisible();
    }
    await presenter.close();
  });

  test('playback advances the date identically on presenter and display', async ({ browser, request }) => {
    const { page: presenter, code } = await openPresenter(browser);
    const display = await openDisplay(browser, code);
    await presenter.locator('.scene-item', { hasText: '22 June 1941' }).click();
    await presenter.getByRole('button', { name: '30 days per second' }).click();
    await presenter.getByRole('button', { name: 'Play timeline' }).click();
    await presenter.waitForTimeout(2000);
    const pDate = await presenter.locator('.timeline-head-label').textContent();
    const dDate = await display.locator('.display-root').getAttribute('data-date');
    await presenter.getByRole('button', { name: 'Pause timeline' }).click();
    const st = await serverState(request, code);
    expect(st.playback.playing).toBe(false);
    // ~60 days after 22 June at 30 days/s; presenter and display agree within a few days.
    expect(st.date > '1941-08-01' && st.date < '1941-09-15').toBeTruthy();
    const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
    const pIso = new Date(Date.parse(pDate! + ' UTC')).toISOString().slice(0, 10);
    expect(days(pIso, dDate!)).toBeLessThan(6);
  });

  test('next/previous event buttons step through dated events', async ({ browser, request }) => {
    const { page: presenter, code } = await openPresenter(browser);
    await presenter.locator('.scene-item', { hasText: '22 June 1941' }).click();
    await presenter.getByRole('button', { name: 'Next dated event' }).click();
    expect((await serverState(request, code)).date).toBe('1941-06-24');
    await presenter.getByRole('button', { name: 'Next dated event' }).click();
    expect((await serverState(request, code)).date).toBe('1941-06-25');
    await presenter.getByRole('button', { name: 'Previous dated event' }).click();
    expect((await serverState(request, code)).date).toBe('1941-06-24');
  });
});
