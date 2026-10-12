'use client';

// Exports the 1920×1080 stage SVG as a PNG. Fonts and the relief raster are inlined as data URLs so the
// rasterised image looks exactly like the live display.

let fontCss: Promise<string> | null = null;
const dataUrlCache = new Map<string, Promise<string>>();

function toDataUrl(url: string): Promise<string> {
  let p = dataUrlCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result as string);
            fr.onerror = reject;
            fr.readAsDataURL(blob);
          }),
      );
    dataUrlCache.set(url, p);
  }
  return p;
}

function embeddedFonts(): Promise<string> {
  fontCss ??= fetch('/fonts/manifest.json')
    .then((r) => r.json())
    .then(async (list: { family: string; weight: number; style: string; file: string; unicodeRange: string }[]) => {
      const faces = await Promise.all(
        list.map(async (f) => `@font-face{font-family:'${f.family}';font-style:${f.style};font-weight:${f.weight};src:url(${await toDataUrl(f.file)}) format('woff2');unicode-range:${f.unicodeRange};}`),
      );
      return faces.join('\n');
    });
  return fontCss;
}

export async function stageToPngBlob(svg: SVGSVGElement, width = 1920, height = 1080, background: string | null = null): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  // Inline raster images (relief, portraits).
  const images = Array.from(clone.querySelectorAll('image'));
  await Promise.all(
    images.map(async (img) => {
      const href = img.getAttribute('href') || img.getAttribute('xlink:href');
      if (href && !href.startsWith('data:')) img.setAttribute('href', await toDataUrl(href));
    }),
  );
  // Strip transient animation helpers.
  clone.querySelectorAll('.stage-fade').forEach((n) => n.remove());
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = await embeddedFonts();
  clone.insertBefore(style, clone.firstChild);
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not rasterise the map'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/**
 * Records the current browser tab (Chrome/Edge: "This tab") with MediaRecorder. Returns a stop function.
 * The user picks the tab in the browser's share dialog; nothing is uploaded.
 */
export async function recordTab(onStop: (blob: Blob) => void): Promise<() => void> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 60, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
    // @ts-expect-error Chromium-only hints
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
  });
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 12_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    onStop(new Blob(chunks, { type: mime || 'video/webm' }));
  };
  stream.getVideoTracks()[0].addEventListener('ended', () => rec.state !== 'inactive' && rec.stop());
  rec.start(1000);
  return () => rec.state !== 'inactive' && rec.stop();
}
