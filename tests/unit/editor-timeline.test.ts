import { describe, expect, it } from 'vitest';
import { audioGainAt, clipAt, clipStarts, deleteClip, makeClip, makeText, moveClip, newProject, parseSrt, projectDuration, splitAt, trimClip, videoDuration } from '../../src/lib/editor/timeline.ts';
import type { MediaItem, Project } from '../../src/lib/editor/types.ts';

const media = (id: string, duration: number, kind: MediaItem['kind'] = 'video'): MediaItem => ({ id, name: id, kind, mime: 'video/mp4', duration, width: 1920, height: 1080, hasAudio: true, thumb: null, peaks: null, createdAt: 0 });

function project(): Project {
  const p = newProject();
  return { ...p, clips: [makeClip(media('a', 4)), makeClip(media('b', 6)), makeClip(media('img', 0, 'image'))] };
}

describe('reels editor timeline', () => {
  it('lays clips end to end; images default to 3 s', () => {
    const p = project();
    expect(clipStarts(p)).toEqual([0, 4, 10]);
    expect(videoDuration(p)).toBe(13);
  });

  it('finds the clip and source time under the playhead', () => {
    const p = project();
    expect(clipAt(p, 0)!.index).toBe(0);
    const h = clipAt(p, 5.5)!;
    expect(h.index).toBe(1);
    expect(h.local).toBeCloseTo(1.5);
    expect(h.source).toBeCloseTo(1.5);
    expect(clipAt(p, 13)!.index).toBe(2); // end of the last clip still shows it
    expect(clipAt(p, 13.5)).toBeNull();
  });

  it('split keeps total length and source continuity', () => {
    const p = splitAt(project(), 6);
    expect(p.clips).toHaveLength(4);
    expect(videoDuration(p)).toBe(13);
    expect(p.clips[1].out).toBeCloseTo(2);
    expect(p.clips[2].in).toBeCloseTo(2);
    expect(p.clips[2].out).toBe(6);
    // Too close to an edge: unchanged.
    expect(splitAt(p, 4.05)).toBe(p);
  });

  it('delete ripples clips and later text left', () => {
    let p = project();
    p = { ...p, texts: [makeText(1), makeText(11)] };
    p = deleteClip(p, p.clips[1].id);
    expect(videoDuration(p)).toBe(7);
    expect(p.texts[0].start).toBe(1);
    expect(p.texts[1].start).toBe(5);
  });

  it('trim is clamped to the media and a minimum length', () => {
    let p = project();
    const id = p.clips[0].id;
    p = trimClip(p, id, 'out', 99, media('a', 4));
    expect(p.clips[0].out).toBe(4);
    p = trimClip(p, id, 'in', 3.95, media('a', 4));
    expect(p.clips[0].in).toBeCloseTo(3.8);
    // Stills can be stretched freely.
    p = trimClip(p, p.clips[2].id, 'out', 10, media('img', 0, 'image'));
    expect(p.clips[2].out).toBe(10);
  });

  it('reorders clips', () => {
    const p = project();
    const q = moveClip(p, 0, 2);
    expect(q.clips.map((c) => c.mediaId)).toEqual(['b', 'img', 'a']);
  });

  it('audio fades and stops at the end of the video', () => {
    const a = { id: 'm', mediaId: 'm', start: 0, in: 0, out: 30, volume: 1, fadeIn: 1, fadeOut: 2 };
    expect(audioGainAt(a, 0.5, 10)).toBeCloseTo(0.5);
    expect(audioGainAt(a, 5, 10)).toBe(1);
    expect(audioGainAt(a, 9, 10)).toBeCloseTo(0.5);
    expect(audioGainAt(a, 10.5, 10)).toBe(0);
  });

  it('project length covers text that runs past the video', () => {
    const p = { ...project(), texts: [{ ...makeText(12), end: 15 }] };
    expect(projectDuration(p)).toBe(15);
  });

  it('parses SRT subtitles', () => {
    const items = parseSrt('1\n00:00:01,000 --> 00:00:02,500\nHello <i>world</i>\n\n2\n00:00:03,000 --> 00:00:04,000\nSecond\nline\n');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ start: 1, end: 2.5, text: 'Hello world', style: 'subtitle' });
    expect(items[1].text).toBe('Second\nline');
  });
});
