/**
 * Lightweight runtime platform detection.
 *
 * Used by the audio + STT pipeline to apply iOS-specific timing fixes
 * (longer post-TTS delay before restarting the mic, audio-session
 * teardown, etc.) without affecting desktop behavior.
 */

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as "Macintosh" but exposes touch — treat as iOS.
  if (
    /Macintosh/.test(ua) &&
    typeof document !== "undefined" &&
    "ontouchend" in document
  ) {
    return true;
  }
  return false;
}

/** Any WebKit-based mobile browser (iOS Safari, iOS Chrome, iOS Edge). */
export function isMobileWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isIOS()) return true;
  const ua = navigator.userAgent || "";
  return /Mobile.*Safari/.test(ua) && !/Chrome|CriOS|Android/.test(ua);
}
