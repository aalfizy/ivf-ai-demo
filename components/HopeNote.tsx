"use client";

import type { SpeakerRole } from "@/lib/types";
import {
  hopeClosingBody,
  hopeClosingTitle,
  hopeIntroBody,
  hopeIntroTitle,
} from "@/lib/uiPhrasing";

/**
 * Calm, hopeful supportive note shown on the report screen.
 * Egyptian Arabic, semi-professional, warm tone — never saccharine.
 *
 * Two variants:
 *   "intro"   → top of report, sets a reassuring tone before the numbers
 *   "closing" → gentle closing message
 *
 * Wording adapts to the inferred speaker role (wife / husband / unknown)
 * so written and spoken layers stay in sync.
 */
export default function HopeNote({
  variant = "intro",
  role = "unknown",
}: {
  variant?: "intro" | "closing";
  role?: SpeakerRole;
}) {
  if (variant === "closing") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-mint-200 bg-gradient-to-br from-mint-50 via-white to-brand-50 p-5 sm:p-6 animate-fade-in-up">
        <SproutDecor />
        <div className="relative flex items-start gap-4">
          <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-soft">
            <SproutIcon />
          </div>
          <div className="leading-relaxed">
            <p className="font-semibold text-ink-900">{hopeClosingTitle}</p>
            <p className="text-sm text-ink-600 mt-1">{hopeClosingBody(role)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/60 via-white to-mint-50/60 p-5 sm:p-6 animate-fade-in-up">
      <SoftHeartDecor />
      <div className="relative flex items-start gap-4">
        <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-soft">
          <CradlingHandsIcon />
        </div>
        <div className="leading-relaxed">
          <p className="text-[11px] tracking-widest text-rose-600 uppercase">
            رحلة الأمل بدأت
          </p>
          <p className="mt-1 font-semibold text-ink-900 text-base sm:text-lg">
            {hopeIntroTitle(role)}
          </p>
          <p className="mt-1 text-sm text-ink-600">{hopeIntroBody(role)}</p>
        </div>
      </div>
    </div>
  );
}

function SoftHeartDecor() {
  return (
    <svg
      aria-hidden
      className="absolute -top-6 -left-6 sm:-top-8 sm:-left-4 h-32 w-32 text-rose-200 opacity-60"
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M60 102 C 24 78, 12 56, 24 36 c 10 -16, 30 -16, 36 4 c 6 -20, 26 -20, 36 -4 c 12 20, 0 42, -36 66 z" />
      <path
        d="M60 92 C 36 76, 26 60, 32 46 c 6 -12, 22 -12, 28 4"
        opacity="0.6"
      />
    </svg>
  );
}

function SproutDecor() {
  return (
    <svg
      aria-hidden
      className="absolute -top-4 -right-4 h-32 w-32 text-mint-300 opacity-50"
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    >
      <path d="M60 110 C 60 80, 56 56, 60 30" />
      <path d="M60 60 C 86 54, 94 38, 88 22 C 70 22, 58 38, 60 60 z" />
      <path d="M60 76 C 36 70, 28 56, 34 40 C 50 40, 60 56, 60 76 z" />
    </svg>
  );
}

function CradlingHandsIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#e11d48"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 17 C 4 11, 9 9, 12 11 C 15 9, 20 11, 21 17" />
      <path d="M12 11 c -1.5 -2.5, -5 -2.5, -5 0 c 0 2.5, 5 4.5, 5 7 c 0 -2.5, 5 -4.5, 5 -7 c 0 -2.5, -3.5 -2.5, -5 0 z" />
    </svg>
  );
}

function SproutIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#059669"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22 C 12 16, 11 12, 12 6" />
      <path d="M12 11 C 17 9, 19 5, 18 2 C 14 2, 11 6, 12 11 z" />
      <path d="M12 14 C 7 12, 5 8, 6 5 C 10 5, 13 9, 12 14 z" />
    </svg>
  );
}
