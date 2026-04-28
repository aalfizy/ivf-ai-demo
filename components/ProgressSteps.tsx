"use client";

import type { StepId } from "@/lib/types";

const ORDER: StepId[] = [
  "age",
  "duration",
  "cycle",
  "hormonal",
  "amh",
  "previous_ivf",
  "previous_pregnancy",
  "male_factor",
  "files",
  "consent",
];

const LABELS: Record<StepId, string> = {
  intro: "البداية",
  age: "السن",
  duration: "مدة المحاولة",
  cycle: "الدورة",
  hormonal: "هرمونات",
  amh: "AMH",
  previous_ivf: "محاولات سابقة",
  previous_pregnancy: "حمل سابق",
  male_factor: "عامل ذكري",
  files: "رفع الملفات",
  summary: "الملخص",
  consent: "الموافقة",
  done: "تم",
};

export default function ProgressSteps({ current }: { current: StepId }) {
  const activeIndex = Math.max(0, ORDER.indexOf(current));
  const total = ORDER.length;
  const pct =
    current === "done"
      ? 100
      : Math.min(100, Math.round(((activeIndex + (current === "consent" ? 1 : 0)) / total) * 100));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-ink-500 mb-2">
        <span>{LABELS[current] ?? "جاري التقييم"}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-ink-100 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-mint-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
