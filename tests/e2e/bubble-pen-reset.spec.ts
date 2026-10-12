import fs from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { closeTracked, openDisplay, openPresenter, serverState, track } from './helpers';

// Chromium's fake camera stands in for the webcam.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });
test.afterEach(closeTracked);

/** Count opaque pixels on the display's pen canvas. */
const inkPixels = (display: Page) =>
  display.locator('canvas.display-ink').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });

test('camera bubble layout: round webcam on the display, panels keep clear of it, screenshot includes it', async ({ browser, request }) => {
  const { page: presenter, code } = await openPresenter(browser);
  await presenter.getByRole('button', { name: 'Bubble', exact: true }).click();
  expect((await serverState(request, code)).layout).toBe('bubble');
  // iPad shows where the bubble covers the map.
  await expect(presenter.locator('.pres-map circle[stroke-dasharray="6 5"]')).toHaveCount(1);

  const ctx = track(await browser.newContext({ viewport: { width: 1920, height: 1080 }, permissions: ['camera'] }));
  const display = await ctx.newPage();
  await display.goto(`/display?code=${code}&cam=1`);
  await expect(display.locator('.display-root[data-status="live"] svg').first()).toBeVisible({ timeout: 15_000 });
  await expect(display.locator('svg[data-layout="bubble"]')).toBeVisible();
  const video = display.locator('video.display-camera.round');
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 10_000 }).toBeGreaterThan(0);
  const box = (await video.boundingBox())!;
  // Bottom-right, round, 340 px across at 1:1 scale.
  expect(Math.round(box.width)).toBe(340);
  expect(box.x + box.width).toBeGreaterThan(1800);
  expect(box.y + box.height).toBeGreaterThan(1000);
  expect(await video.evaluate((v) => getComputedStyle(v).borderRadius)).toBe('50%');

  // Screenshot: the webcam frame is composited into the PNG inside the circle.
  await display.mouse.move(500, 40);
  const [download] = await Promise.all([display.waitForEvent('download'), display.getByRole('button', { name: 'Screenshot' }).click()]);
  const b64 = fs.readFileSync((await download.path())!).toString('base64');
  // The bubble's light ring is only present when the camera frame was composited.
  const ring = await display.evaluate(async (src) => {
    const img = new Image();
    img.src = `data:image/png;base64,${src}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const [r, g, b] = ctx.getImageData(1920 - 48 - 170, 1080 - 48 - 340 + 3, 1, 1).data;
    return { w: img.width, h: img.height, r, g, b };
  }, b64);
  expect([ring.w, ring.h]).toEqual([1920, 1080]);
  expect(ring.r).toBeGreaterThan(220);
  expect(ring.b).toBeGreaterThan(200);

  // Switching to Full hides the camera (full-width map moment).
  await presenter.getByRole('button', { name: 'Full', exact: true }).click();
  await expect(video).toBeHidden();
});

test('screen pen on the display: draw, undo, clear, and cleared on the next scene step', async ({ browser }) => {
  const { page: presenter, code } = await openPresenter(browser);
  const display = await openDisplay(browser, code);
  expect(await inkPixels(display)).toBe(0);
  await display.keyboard.press('p');
  await display.mouse.move(700, 500);
  await display.mouse.down();
  await display.mouse.move(800, 520, { steps: 5 });
  await display.mouse.move(900, 500, { steps: 5 });
  await display.mouse.up();
  const drawn = await inkPixels(display);
  expect(drawn).toBeGreaterThan(500);
  // A second stroke, then undo it.
  await display.mouse.move(700, 700);
  await display.mouse.down();
  await display.mouse.move(900, 700, { steps: 5 });
  await display.mouse.up();
  expect(await inkPixels(display)).toBeGreaterThan(drawn);
  await display.keyboard.press('z');
  expect(await inkPixels(display)).toBe(drawn);
  await display.keyboard.press('c');
  expect(await inkPixels(display)).toBe(0);
  // Ink is cleared when the presenter moves on.
  await display.mouse.move(700, 500);
  await display.mouse.down();
  await display.mouse.move(900, 500, { steps: 5 });
  await display.mouse.up();
  expect(await inkPixels(display)).toBeGreaterThan(0);
  await presenter.keyboard.press('ArrowRight');
  await expect.poll(() => inkPixels(display)).toBe(0);
  // Pen off: the canvas lets clicks through.
  await display.keyboard.press('Escape');
  expect(await display.locator('canvas.display-ink').evaluate((c) => getComputedStyle(c).pointerEvents)).toBe('none');
});

test('start over: restart the episode, or clear to a blank map', async ({ browser, request }) => {
  const { page: presenter, code } = await openPresenter(browser);
  await presenter.locator('.scene-item', { hasText: 'Battle of Moscow' }).click();
  await presenter.getByRole('button', { name: 'Circle' }).click();
  const box = (await presenter.locator('.pres-map').boundingBox())!;
  await presenter.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await presenter.mouse.down();
  await presenter.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 4 });
  await presenter.mouse.up();
  await presenter.getByRole('button', { name: 'Hide UI — hide all audience panels' }).click();
  let st = await serverState(request, code);
  expect(st.sceneIndex).toBeGreaterThan(0);
  expect(st.annotations).toHaveLength(1);
  expect(st.hideUi).toBe(true);

  await presenter.getByRole('button', { name: 'Start over' }).click();
  await presenter.getByRole('button', { name: /Restart the episode/ }).click();
  st = await serverState(request, code);
  expect(st.sceneIndex).toBe(0);
  expect(st.stepIndex).toBe(0);
  expect(st.sceneId).not.toBeNull();
  expect(st.annotations).toHaveLength(0);
  expect(st.hideUi).toBe(false);

  await presenter.getByRole('button', { name: 'Start over' }).click();
  await presenter.getByRole('button', { name: /Blank map/ }).click();
  st = await serverState(request, code);
  expect(st.sceneId).toBeNull();
  expect(st.date).toBe('1939-08-23'); // start of the timeline
  expect(st.focus.formations).toHaveLength(0);
  expect(st.annotations).toHaveLength(0);
  // Next begins scene 1.
  await presenter.keyboard.press('ArrowRight');
  await expect.poll(async () => (await serverState(request, code)).sceneIndex).toBe(0);
  expect((await serverState(request, code)).sceneId).not.toBeNull();
});
