import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

// Reels editor. The test browser has no H.264/AAC encoder, so exports force VP9/Opus — in an MP4
// container for the WebCodecs path (same muxing code as H.264/AAC) and real-time recording for the fallback.

const F = (n: string) => path.join(import.meta.dirname, 'fixtures', n);
const time = async (p: Page) => (await p.locator('.ed-time').textContent())!.split(' / ').map((s) => {
  const [m, sec] = s.split(':');
  return Number(m) * 60 + Number(sec);
});

async function openWithMedia(page: Page) {
  await page.goto('/editor');
  await expect(page.locator('.ed-loading')).toHaveCount(0);
  await page.setInputFiles('input[aria-label="Import media files"]', [F('clip-landscape.webm'), F('clip-portrait.webm'), F('photo.png'), F('music.ogg')]);
  await expect(page.locator('.tl-item.clip')).toHaveCount(3, { timeout: 20_000 });
  await expect(page.locator('.tl-item.audio')).toHaveCount(1);
}

/** Load an exported file in the page and read its length and frame size. */
async function probe(page: Page, file: string) {
  const fs = await import('node:fs');
  const b64 = fs.readFileSync(file).toString('base64');
  return page.evaluate(async ({ b64, type }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const v = document.createElement('video');
    v.muted = true;
    v.src = URL.createObjectURL(new Blob([bytes], { type }));
    await new Promise((r, j) => ((v.onloadedmetadata = r), (v.onerror = () => j(new Error('cannot play')))));
    if (!Number.isFinite(v.duration)) {
      v.currentTime = 1e7;
      await new Promise((r) => (v.onseeked = r));
    }
    return { duration: v.duration, w: v.videoWidth, h: v.videoHeight, head: String.fromCharCode(...bytes.slice(4, 8)) };
  }, { b64, type: file.endsWith('.mp4') ? 'video/mp4' : 'video/webm' });
}

test('editor: import builds a timeline; split, delete, undo; text; autosave survives reload', async ({ page }) => {
  await openWithMedia(page);
  // 3 s + 2 s + 3 s still; music under it.
  expect((await time(page))[1]).toBeCloseTo(8, 1);

  // Split at 1.5 s.
  await page.keyboard.press('Shift+ArrowRight');
  for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowRight');
  expect((await time(page))[0]).toBeCloseTo(1.5, 1);
  await page.keyboard.press('s');
  await expect(page.locator('.tl-item.clip')).toHaveCount(4);
  expect((await time(page))[1]).toBeCloseTo(8, 1);

  // Delete the second piece, then undo.
  await page.locator('.tl-item.clip').nth(1).click({ position: { x: 30, y: 30 } });
  await page.keyboard.press('Delete');
  await expect(page.locator('.tl-item.clip')).toHaveCount(3);
  expect((await time(page))[1]).toBeCloseTo(6.5, 1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.tl-item.clip')).toHaveCount(4);

  // Text: add, type, style, drag in the preview.
  await page.getByRole('button', { name: '+ Text' }).click();
  await page.getByLabel('Text', { exact: true }).fill('Operation Barbarossa');
  await page.locator('.style-chip', { hasText: 'Box' }).first().click();
  await expect(page.locator('.tl-item.text')).toHaveCount(1);
  const canvas = page.locator('canvas.pv-canvas');
  const box = (await canvas.boundingBox())!;
  // New text sits at 62 % of the frame height (changing the style keeps its position); drag it up to ~40 %.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.62);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.4, { steps: 6 });
  await page.mouse.up();

  await page.getByRole('textbox', { name: 'Project name' }).fill('Barbarossa reel');
  await page.waitForTimeout(900); // autosave debounce
  await page.reload();
  await expect(page.locator('.ed-loading')).toHaveCount(0);
  await expect(page.locator('.tl-item.clip')).toHaveCount(4);
  await expect(page.locator('.tl-item.text')).toHaveText('Operation Barbarossa');
  await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue('Barbarossa reel');
  // The dragged position was saved.
  await page.locator('.tl-item.text').click();
  const y = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((r) => { const q = indexedDB.open('atlas-editor'); q.onsuccess = () => r(q.result); });
    const all: { texts: { y: number }[] }[] = await new Promise((r) => { const q = db.transaction('projects').objectStore('projects').getAll(); q.onsuccess = () => r(q.result); });
    return all[0].texts[0].y;
  });
  expect(y).toBeGreaterThan(0.35);
  expect(y).toBeLessThan(0.45);
});

test('editor: fast export makes a 1080×1920 MP4 of the right length', async ({ page }) => {
  await openWithMedia(page);
  await page.evaluate(() => {
    (window as unknown as { __atlasExportPlan: unknown }).__atlasExportPlan = { container: 'mp4', video: 'vp09.00.40.08', audio: 'opus' };
  });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: /^Export .* video$/ }).click();
  await expect(page.locator('.ed-result video')).toBeVisible({ timeout: 90_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/\.mp4$/);
  const out = test.info().outputPath('reel.mp4');
  await dl.saveAs(out);
  const info = await probe(page, out);
  expect(info.head).toBe('ftyp');
  expect([info.w, info.h]).toEqual([1080, 1920]);
  expect(info.duration).toBeGreaterThan(7.8);
  expect(info.duration).toBeLessThan(8.3);
});

test('editor: real-time fallback export (Safari/iPad path) produces a video', async ({ page }) => {
  await page.goto('/editor');
  await expect(page.locator('.ed-loading')).toHaveCount(0);
  await page.setInputFiles('input[aria-label="Import media files"]', [F('clip-portrait.webm')]);
  await expect(page.locator('.tl-item.clip')).toHaveCount(1, { timeout: 20_000 });
  await page.evaluate(() => {
    (window as unknown as { __atlasExportPlan: unknown }).__atlasExportPlan = 'realtime';
  });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: /^Export .* video$/ }).click();
  await expect(page.locator('.ed-result video')).toBeVisible({ timeout: 60_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()]);
  const out = test.info().outputPath(dl.suggestedFilename());
  await dl.saveAs(out);
  const info = await probe(page, out);
  expect([info.w, info.h]).toEqual([1080, 1920]);
  expect(info.duration).toBeGreaterThan(1.7);
  expect(info.duration).toBeLessThan(2.6);
});

test('editor: iPad portrait layout fits without horizontal scrolling', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('/editor');
  await expect(page.locator('.ed-loading')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(820);
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeInViewport();
  await expect(page.getByRole('tab', { name: 'Media' })).toBeVisible();
  await ctx.close();
});
