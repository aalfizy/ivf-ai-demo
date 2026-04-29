"use client";

/**
 * Soft photographic background for emotional context (IVF / hope theme).
 *
 * Layout (z-stack, bottom → top):
 *   1. Photo layer  — /images/family.jpg, full-screen `cover`, centered,
 *                     light blur, fades in on first paint.
 *   2. White overlay — opacity 0.7 across the whole viewport so foreground
 *                     text stays fully readable on every breakpoint.
 *   3. Subtle wash   — brand→mint gradient at very low opacity to keep the
 *                     medical/clinical mood instead of a pure-white card.
 *
 * Mounted as `fixed inset-0 -z-10 pointer-events-none` so it never
 * interferes with the UI, never costs anything in interaction, and is
 * automatically responsive (viewport-sized).
 *
 * Hidden during print so the report PDF remains clean.
 */

export default function PhotoBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden"
      aria-hidden="true"
    >
      {/* 1. Photo — cover, center, slight blur, fades in */}
      <div
        className="absolute inset-0 animate-fade-in bg-center bg-cover"
        style={{
          backgroundImage: "url('/images/family.jpg')",
          filter: "blur(4px) saturate(1.05)",
          // Slight scale prevents blurred edges from leaving a hard line at
          // the viewport border.
          transform: "scale(1.05)",
          animationDuration: "1.4s",
        }}
      />

      {/* 2. White readability overlay (opacity 0.7) */}
      <div className="absolute inset-0 bg-white/70" />

      {/* 3. Soft medical wash to avoid pure-white flatness */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50/40 via-transparent to-mint-50/40" />
    </div>
  );
}
