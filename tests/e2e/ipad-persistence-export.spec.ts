import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { IPAD_LANDSCAPE, IPAD_PORTRAIT, openDisplay, openPresenter, serverState } from './helpers';
import { project } from '../../src/lib/map/projection';

for (const [name, viewport] of [['landscape', IPAD_LANDSCAPE], ['portrait', IPAD_PORTRAIT]] as const) {
  test(`iPad ${name}: layout fits, touch targets are large enough`, async ({ browser }, info) => {
    const { page } = await openPresenter(browser, viewport);
    await page.waitForTimeout(1500);
    // No horizontal overflow of the page.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Primary controls are visible and at least 44 px (Apple HIG) in both dimensions.
    for (const sel of ['.next-btn', '[aria-label="Play timeline"]', '[aria-label="Previous scene step"]', '[aria-label="Pan & zoom"]', '[aria-label="Freehand"]', '[aria-label="Undo"]', '.lock-btn']) {
      const box = await page.locator(sel).first().boundingBox();
      expect(box, sel).not.toBeNull();
      expect(box!.width, sel).toBeGreaterThanOrEqual(44);
      expect(box!.height, sel).toBeGreaterThanOrEqual(44);
      expect(box!.x + box!.width, sel).toBeLessThanOrEqual(viewport.width + 1);
      expect(box!.y + box!.height, sel).toBeLessThanOrEqual(viewport.height + 1);
    }
    await page.screenshot({ path: info.outputPath(`presenter-${name}.png`) });
  });
}

test('touch gestures: drag pans and the camera syncs', async ({ browser, request }) => {
  const { page, code } = await openPresenter(browser);
  const box = (await page.locator('.pres-map-input').boundingBox())!;
  const before = (await serverState(request, code)).camera;
  // Synthesise a one-finger drag with touch pointer events.
  await page.locator('.pres-map-input').dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: box.x + 300, clientY: box.y + 300, isPrimary: true, buttons: 1 });
  for (let i = 1; i <= 10; i++) {
    await page.locator('.pres-map-input').dispatchEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: box.x + 300 - i * 15, clientY: box.y + 300, isPrimary: true, buttons: 1 });
    await page.waitForTimeout(20);
  }
  await page.locator('.pres-map-input').dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: box.x + 150, clientY: box.y + 300, isPrimary: true });
  await page.waitForTimeout(300);
  const after = (await serverState(request, code)).camera;
  // Dragging left moves the view centre right in projected (screen-aligned) coordinates, not vertically.
  const [x0, y0] = project([before.lon, before.lat]);
  const [x1, y1] = project([after.lon, after.lat]);
  expect(x1).toBeGreaterThan(x0);
  expect(Math.abs(y1 - y0)).toBeLessThan(Math.abs(x1 - x0) * 0.05);
});

test('presentation lock blocks map edits but keeps Next working', async ({ browser, request }) => {
  const { page, code } = await openPresenter(browser);
  await page.locator('.lock-btn').click();
  await expect(page.locator('.pres.is-locked')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Freehand' })).toBeDisabled();
  await page.locator('.next-btn').click();
  expect((await serverState(request, code)).stepIndex).toBe(1);
  // Hold to unlock.
  const lock = page.locator('.lock-btn');
  await lock.dispatchEvent('pointerdown');
  await page.waitForTimeout(1100);
  await lock.dispatchEvent('pointerup');
  await expect(page.locator('.pres.is-locked')).toHaveCount(0);
});

test('scene editor: edits autosave, survive reload, export and re-import', async ({ browser }) => {
  const { page } = await openPresenter(browser);
  await page.getByRole('tab', { name: 'Episode' }).click();
  const title = page.locator('#sc-title');
  await title.fill('Europe on the eve — edited');
  await page.waitForTimeout(900); // autosave debounce
  await page.reload();
  await expect(page.locator('.conn.live')).toBeVisible();
  await page.getByRole('tab', { name: 'Episode' }).click();
  await expect(page.locator('#sc-title')).toHaveValue('Europe on the eve — edited');
  await expect(page.locator('select').first()).toContainText('(edited)');
  // Export.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export/ }).click()]);
  const file = await download.path();
  const ep = JSON.parse(fs.readFileSync(file!, 'utf8'));
  expect(ep.schema).toBe(1);
  expect(ep.scenes[0].title).toBe('Europe on the eve — edited');
  // Import as a new episode.
  ep.id = 'imported-test';
  ep.title = 'Imported test episode';
  const tmp = file + '.json';
  fs.writeFileSync(tmp, JSON.stringify(ep));
  await page.locator('input[type="file"]').setInputFiles(tmp);
  await expect(page.locator('.top-episode')).toHaveText('Imported test episode');
  // Add a step from the current view, then save to the computer.
  await page.getByRole('button', { name: /Add step from current view/ }).click();
  await page.getByRole('button', { name: 'Save to computer' }).click();
  await expect(page.locator('.notice')).toContainText('Saved');
});

test('1080p screenshot export from the display', async ({ browser }) => {
  const { code } = await openPresenter(browser);
  const display = await openDisplay(browser, code);
  await display.mouse.move(500, 500);
  const [download] = await Promise.all([display.waitForEvent('download'), display.getByRole('button', { name: 'Screenshot' }).click()]);
  const buf = fs.readFileSync((await download.path())!);
  expect(buf.subarray(1, 4).toString()).toBe('PNG');
  expect(buf.readUInt32BE(16)).toBe(1920);
  expect(buf.readUInt32BE(20)).toBe(1080);
});

test('accessibility: no serious or critical axe violations', async ({ browser }) => {
  const { page, code } = await openPresenter(browser);
  const display = await openDisplay(browser, code);
  const results: string[] = [];
  for (const [label, p] of [['presenter', page], ['display', display]] as const) {
    const r = await new AxeBuilder({ page: p }).disableRules(['region']).analyze();
    for (const v of r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')) results.push(`${label}: ${v.id} (${v.nodes.length}) ${v.help} — ${v.nodes.slice(0, 6).map((n) => n.target.join(' ')).join(' | ')}`);
  }
  const home = await (await browser.newContext()).newPage();
  for (const path of ['/', '/sources']) {
    await home.goto(path);
    const r = await new AxeBuilder({ page: home }).analyze();
    for (const v of r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')) results.push(`${path}: ${v.id} (${v.nodes.length}) ${v.help}`);
  }
  console.log(results.join('\n') || 'no serious/critical violations');
  expect(results).toEqual([]);
});

test('performance: display frame times during a camera flight', async ({ browser, request }) => {
  const { page: presenter, code } = await openPresenter(browser);
  const display = await openDisplay(browser, code, '&clean=1');
  await display.waitForTimeout(1000);
  await display.evaluate(() => {
    (window as unknown as { __frames: number[] }).__frames = [];
    let last = performance.now();
    const loop = (t: number) => {
      (window as unknown as { __frames: number[] }).__frames.push(t - last);
      last = t;
      if ((window as unknown as { __frames: number[] }).__frames.length < 600) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await presenter.locator('.scene-item', { hasText: 'Battle of Moscow' }).click();
  await display.waitForTimeout(2600);
  const frames: number[] = await display.evaluate(() => (window as unknown as { __frames: number[] }).__frames.slice(5));
  frames.sort((a, b) => a - b);
  const median = frames[Math.floor(frames.length / 2)];
  const p95 = frames[Math.floor(frames.length * 0.95)];
  console.log(`display frames: n=${frames.length} median=${median.toFixed(1)}ms p95=${p95.toFixed(1)}ms (headless software rendering)`);
  expect(median).toBeLessThan(60);
  expect((await serverState(request, code)).sceneId).toBe('s7-moscow');
});
