"use client";

import { useEffect, useRef, useState } from "react";
import type { SpeakerRole } from "@/lib/types";
import {
  fileUploadChooseLabel,
  fileUploadHelp,
  fileUploadTitle,
} from "@/lib/uiPhrasing";

export default function FileUpload({
  files,
  onFilesChange,
  highlighted,
  role = "unknown",
}: {
  files: string[];
  onFilesChange: (names: string[], added: string[]) => void;
  highlighted?: boolean;
  role?: SpeakerRole;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pulse, setPulse] = useState(false);

  // Brief pulse when highlighted turns on
  useEffect(() => {
    if (!highlighted) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 2200);
    return () => clearTimeout(t);
  }, [highlighted]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list) return;
    const incoming: string[] = [];
    for (let i = 0; i < list.length; i++) incoming.push(list[i]!.name);
    const merged = Array.from(new Set([...files, ...incoming]));
    const added = merged.filter((n) => !files.includes(n));
    onFilesChange(merged, added);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeOne = (name: string) => {
    const next = files.filter((n) => n !== name);
    onFilesChange(next, []);
  };

  return (
    <div className="w-full">
      <label
        className={[
          "group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition",
          highlighted
            ? "border-brand-400 bg-gradient-to-br from-brand-50 to-mint-50 shadow-soft"
            : "border-dashed border-brand-300 bg-white/70 hover:bg-white",
          pulse ? "animate-pulse-soft" : "",
        ].join(" ")}
      >
        <div className="flex items-center gap-3">
          <div
            className={[
              "flex h-10 w-10 items-center justify-center rounded-xl transition",
              highlighted
                ? "bg-brand-500 text-white"
                : "bg-brand-100 text-brand-700",
            ].join(" ")}
          >
            <PaperclipIcon />
          </div>
          <div>
            <p className="text-sm text-ink-800 font-medium">
              {fileUploadTitle(role, !!highlighted)}
            </p>
            <p className="text-xs text-ink-500">{fileUploadHelp(role)}</p>
          </div>
        </div>
        <span
          className={[
            "text-xs px-3 py-1 rounded-full transition",
            highlighted
              ? "bg-brand-600 text-white"
              : "text-brand-700 bg-brand-50",
          ].join(" ")}
        >
          {fileUploadChooseLabel(role, !!highlighted)}
        </span>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="application/pdf,image/*"
          multiple
          onChange={handleChange}
        />
      </label>

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((name) => (
            <li
              key={name}
              className="flex items-center justify-between gap-2 rounded-xl bg-white/85 border border-ink-100 px-3 py-2 text-sm animate-fade-in-up"
            >
              <span className="flex items-center gap-2 truncate">
                <DocIcon />
                <span className="truncate">{name}</span>
                <span className="hidden sm:inline text-[11px] text-mint-700 bg-mint-50 px-2 py-0.5 rounded-full border border-mint-200">
                  ✓ تم الاستلام
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeOne(name)}
                className="text-ink-400 hover:text-red-500"
                aria-label="إزالة"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PaperclipIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.4 17.43a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#0ea5e9"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
