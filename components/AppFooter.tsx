"use client";

import { useState } from "react";
import {
  VERSION_INFO,
  buildDescriptor,
  formatBuildDate,
} from "@/lib/version";

/**
 * Unobtrusive global footer shown at the bottom of every screen.
 *
 *   Powered by SERVERAT · Zorrya AI v1.0.1
 *
 * Tapping the version badge expands a compact metadata card with the
 * full build descriptor (version, git commit, build date, channel) so
 * the deployed version can be verified at a glance — useful when
 * deciding whether you're on a rollback or a current release.
 *
 * Hover-only tooltip (`title`) keeps the metadata reachable on desktop
 * without occupying any vertical space.
 */
export default function AppFooter() {
  const [open, setOpen] = useState(false);

  const channelLabel =
    VERSION_INFO.channel === "rollback"
      ? "ROLLBACK"
      : VERSION_INFO.channel === "release"
      ? "RELEASE"
      : "DEV";

  const channelClass =
    VERSION_INFO.channel === "rollback"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : VERSION_INFO.channel === "release"
      ? "bg-mint-50 text-mint-700 border-mint-200"
      : "bg-ink-50 text-ink-500 border-ink-200";

  return (
    <footer
      dir="ltr"
      className="mt-6 flex flex-col items-center gap-1.5 pb-3 select-none"
    >
      <p className="text-center text-[9px] tracking-[0.2em] uppercase text-ink-400/70">
        Powered by{" "}
        <span className="font-medium text-ink-500">SERVERAT</span>
        <span aria-hidden className="mx-1.5 text-ink-300">
          ·
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={buildDescriptor()}
          className="font-medium text-ink-500 hover:text-ink-700 transition cursor-pointer"
          aria-expanded={open}
          aria-controls="zorrya-version-meta"
        >
          {VERSION_INFO.label}
        </button>
      </p>

      {open && (
        <div
          id="zorrya-version-meta"
          className="animate-fade-in-up flex flex-col items-center gap-1 rounded-xl border border-ink-100 bg-white/80 px-3 py-2 text-[10px] text-ink-600 shadow-soft backdrop-blur"
        >
          <div className="flex items-center gap-2">
            <span
              className={[
                "rounded-full border px-1.5 py-0.5 text-[8px] font-semibold tracking-widest",
                channelClass,
              ].join(" ")}
            >
              {channelLabel}
            </span>
            <span className="font-semibold text-ink-800">
              {VERSION_INFO.label}
            </span>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-[10px]">
            <dt className="text-ink-400">commit</dt>
            <dd className="font-mono text-ink-700">{VERSION_INFO.commit}</dd>
            <dt className="text-ink-400">built</dt>
            <dd className="font-mono text-ink-700">
              {formatBuildDate(VERSION_INFO.buildDate)}
            </dd>
            <dt className="text-ink-400">channel</dt>
            <dd className="font-mono text-ink-700">{VERSION_INFO.channel}</dd>
          </dl>
        </div>
      )}
    </footer>
  );
}
