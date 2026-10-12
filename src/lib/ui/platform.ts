'use client';

/** Copy text; falls back to a prompt where the Clipboard API is unavailable (plain-HTTP LAN addresses on iPad). */
export async function copyText(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  window.prompt('Copy this link', text);
  return false;
}

type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };

/** Toggle fullscreen, including the prefixed WebKit API used by iPadOS Safari. Returns false if unsupported. */
export async function toggleFullscreen(): Promise<boolean> {
  const doc = document as FsDocument;
  const el = document.documentElement as FsElement;
  try {
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return true;
    }
    if (el.requestFullscreen) {
      await el.requestFullscreen();
      return true;
    }
    if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
      return true;
    }
  } catch {
    /* not allowed */
  }
  return false;
}
