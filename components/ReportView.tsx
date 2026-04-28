"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  clearSession,
  loadSession,
  saveSession,
  type SessionData,
} from "@/lib/session";
import { predict } from "@/lib/prediction";
import type { Answers, ConfidenceLevel } from "@/lib/types";
import HopeNote from "./HopeNote";

type ConsentState = "idle" | "sending" | "sent";

export default function ReportView() {
  const [data, setData] = useState<SessionData | null>(null);
  const [consent, setConsent] = useState<ConsentState>("idle");

  useEffect(() => {
    setData(loadSession());
  }, []);

  const prediction = useMemo(() => {
    if (!data) return null;
    return data.prediction ?? predict(data.answers ?? {});
  }, [data]);

  if (!data) {
    return (
      <div className="glass rounded-3xl p-8 text-center shadow-soft">
        <p className="text-ink-600">ماعندناش بيانات جلسة لسه.</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-xl bg-brand-600 text-white px-4 py-2 text-sm hover:bg-brand-700 transition"
        >
          ابدئي الجلسة
        </Link>
      </div>
    );
  }

  const a = data.answers ?? {};
  const p = prediction!;

  const handleSend = () => {
    setConsent("sending");
    setTimeout(() => {
      setConsent("sent");
      saveSession({ ...data, completedAt: Date.now() });
    }, 1400);
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  const handleNew = () => {
    clearSession();
    if (typeof window !== "undefined") window.location.href = "/";
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/"
          className="text-sm text-ink-500 hover:text-ink-800 transition"
        >
          ← رجوع
        </Link>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="rounded-xl border border-ink-200 bg-white/80 px-3 py-2 text-xs text-ink-700 hover:bg-white transition"
          >
            طباعة / PDF
          </button>
          <button
            onClick={handleNew}
            className="rounded-xl border border-ink-200 bg-white/80 px-3 py-2 text-xs text-ink-700 hover:bg-white transition"
          >
            جلسة جديدة
          </button>
        </div>
      </div>

      <article className="glass rounded-3xl p-6 sm:p-10 shadow-soft animate-fade-in-up print:shadow-none print:bg-white">
        <ReportHeader />

        <div className="mb-6">
          <HopeNote variant="intro" />
        </div>

        <PredictionHero
          low={p.low}
          high={p.high}
          mid={p.mid}
          category={p.category}
          confidence={p.confidence}
        />

        <Section title="ملخص الحالة">
          <p className="text-ink-700 leading-7">{p.summary}</p>
        </Section>

        <Section title="البيانات الأساسية">
          <DataGrid answers={a} />
        </Section>

        {p.fileFindings.length > 0 && (
          <Section title="الملفات المرفوعة وما تم استخراجه منها">
            <ul className="space-y-2">
              {p.fileFindings.map((f) => (
                <li
                  key={f.filename}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-white/80 border border-brand-100 px-4 py-3"
                >
                  <span className="text-sm font-medium text-ink-800 truncate">
                    {f.filename}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {f.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-mint-50 text-mint-700 border border-mint-200"
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {p.riskFactors.length > 0 && (
          <Section title="عوامل الخطر">
            <ul className="space-y-2">
              {p.riskFactors.map((f, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-amber-900"
                >
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="leading-7">{f}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {p.contributingFactors.length > 0 && (
          <Section title="نقاط داعمة في الحالة">
            <ul className="space-y-2">
              {p.contributingFactors.map((f, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl bg-white/70 border border-ink-100 px-4 py-2 text-ink-700"
                >
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-brand-500 shrink-0" />
                  <span className="leading-7">{f}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="التحاليل والفحوصات المقترحة">
          <ul className="grid sm:grid-cols-2 gap-2">
            {p.suggestedTests.map((t, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-xl bg-mint-50 border border-mint-100 px-3 py-2 text-ink-700 text-sm"
              >
                <span className="mt-0.5 text-mint-600">✓</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="الخطوات التالية المقترحة">
          <ol className="space-y-2">
            {p.nextSteps.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl bg-gradient-to-br from-white to-brand-50 border border-brand-100 px-4 py-2.5 text-ink-700"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="leading-7">{s}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Disclaimer />

        <div className="mt-8 print:hidden">
          <ConsentBox
            state={consent}
            onSend={handleSend}
            onCancel={() => setConsent("idle")}
          />
        </div>
      </article>
    </div>
  );
}

function ReportHeader() {
  const today = new Date();
  const date = today.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const ref = useMemo(
    () =>
      "IVF-" +
      Math.random().toString(36).slice(2, 8).toUpperCase() +
      "-" +
      today.getFullYear(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  return (
    <header className="flex items-start justify-between gap-4 border-b border-ink-100 pb-5 mb-6">
      <div>
        <p className="text-[11px] tracking-widest text-brand-700 uppercase">
          Initial IVF Assessment Report
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-ink-900">
          التقرير المبدئي للحقن المجهري
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          تاريخ التقرير: {date} · مرجع: {ref}
        </p>
      </div>
      <div className="shrink-0 h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-500 to-mint-400 flex items-center justify-center text-white shadow-soft">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.65-7 10-7 10Z" />
        </svg>
      </div>
    </header>
  );
}

function PredictionHero({
  low,
  high,
  mid,
  category,
  confidence,
}: {
  low: number;
  high: number;
  mid: number;
  category: string;
  confidence: ConfidenceLevel;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-6 border border-brand-100 bg-gradient-to-br from-white to-brand-50">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <p className="text-xs text-brand-700 font-medium">
            احتمالية النجاح المبدئية
          </p>
          <div className="mt-1 flex items-baseline gap-2 text-ink-900">
            <span className="text-4xl font-bold">{low}%</span>
            <span className="text-ink-400">—</span>
            <span className="text-4xl font-bold">{high}%</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-600">
              التصنيف:{" "}
              <span className="font-semibold text-ink-900">{category}</span>
            </span>
            <ConfidenceBadge level={confidence} />
          </div>
        </div>
        <div className="w-full sm:w-56">
          <ConfidenceGauge value={mid} />
        </div>
      </div>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const map = {
    high: {
      label: "ثقة عالية",
      className:
        "bg-mint-100 text-mint-700 border-mint-200",
      dot: "bg-mint-500",
    },
    medium: {
      label: "ثقة متوسطة",
      className: "bg-brand-50 text-brand-700 border-brand-200",
      dot: "bg-brand-500",
    },
    low: {
      label: "ثقة مبدئية",
      className: "bg-amber-50 text-amber-800 border-amber-200",
      dot: "bg-amber-500",
    },
  } as const;
  const cfg = map[level];
  return (
    <span
      className={[
        "inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-full border",
        cfg.className,
      ].join(" ")}
    >
      <span className={["h-2 w-2 rounded-full", cfg.dot].join(" ")} />
      {cfg.label}
    </span>
  );
}

function ConfidenceGauge({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="h-3 w-full rounded-full bg-ink-100 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 via-brand-400 to-mint-400 transition-all duration-700"
          style={{ width: `${v}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink-400">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <h2 className="text-ink-900 font-semibold text-lg mb-3">{title}</h2>
      {children}
    </section>
  );
}

function DataGrid({ answers }: { answers: Answers }) {
  const rows: { label: string; value: string }[] = [
    { label: "السن", value: answers.age ? `${answers.age} سنة` : "—" },
    {
      label: "مدة المحاولة",
      value:
        answers.duration_years !== undefined
          ? `${answers.duration_years} سنة`
          : "—",
    },
    {
      label: "انتظام الدورة",
      value:
        answers.cycle_regular === true
          ? "منتظمة"
          : answers.cycle_regular === false
          ? "غير منتظمة"
          : "—",
    },
    {
      label: "تكيس المبايض",
      value:
        answers.pcos === true ? "نعم" : answers.pcos === false ? "لا" : "—",
    },
    {
      label: "مشاكل هرمونية",
      value:
        answers.hormonal_issues === true
          ? "نعم"
          : answers.hormonal_issues === false
          ? "لا"
          : "—",
    },
    {
      label: "AMH",
      value:
        typeof answers.amh === "number"
          ? `${answers.amh}`
          : answers.amh === "unknown"
          ? "غير معروف"
          : "—",
    },
    {
      label: "محاولات سابقة",
      value:
        answers.previous_ivf_count !== undefined
          ? `${answers.previous_ivf_count}`
          : "—",
    },
    {
      label: "حمل سابق",
      value:
        answers.previous_pregnancy === true
          ? "نعم"
          : answers.previous_pregnancy === false
          ? "لا"
          : "—",
    },
    {
      label: "عامل ذكري",
      value:
        answers.male_factor === true
          ? "نعم"
          : answers.male_factor === false
          ? "لا"
          : "—",
    },
    {
      label: "ملفات مرفوعة",
      value: answers.uploaded_files?.length
        ? `${answers.uploaded_files.length} ملف`
        : "لا يوجد",
    },
  ];

  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-center justify-between rounded-xl bg-white/70 border border-ink-100 px-4 py-2.5"
        >
          <span className="text-sm text-ink-500">{r.label}</span>
          <span className="text-sm font-medium text-ink-800">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm leading-7">
      <strong className="block mb-1">تنويه مهم</strong>
      ده تقييم مبدئي مبني على البيانات المقدمة فقط، ولا يغني عن زيارة الطبيب
      المختص. القرار النهائي بيعتمد على الفحص السريري والتحاليل الفعلية.
    </div>
  );
}

function ConsentBox({
  state,
  onSend,
  onCancel,
}: {
  state: ConsentState;
  onSend: () => void;
  onCancel: () => void;
}) {
  if (state === "sent") {
    return (
      <div className="space-y-3 animate-fade-in-up">
        <div className="rounded-2xl border border-mint-200 bg-mint-50 p-5 text-ink-800">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-mint-500 text-white">
              ✓
            </div>
            <div>
              <p className="font-semibold text-mint-700">
                تم إرسال البيانات وسيتم التواصل معك قريبًا
              </p>
              <p className="text-sm text-ink-600 mt-1">
                شكراً لثقتك. فريق المركز هيتواصل معاكي خلال وقت قصير إن شاء الله.
              </p>
            </div>
          </div>
        </div>
        <HopeNote variant="closing" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-white/80 p-5">
      <p className="text-ink-800 font-medium">تحبي نبعت التقرير للمركز؟</p>
      <p className="text-sm text-ink-500 mt-1">
        هيتم التواصل معاكي لحجز معاد أو لتوضيح أي استفسار.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onSend}
          disabled={state === "sending"}
          className="rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60"
        >
          {state === "sending" ? "جاري الإرسال…" : "نعم، ابعتي"}
        </button>
        <button
          onClick={onCancel}
          disabled={state === "sending"}
          className="rounded-xl bg-white border border-ink-200 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50 transition"
        >
          لا، شكرًا
        </button>
      </div>
    </div>
  );
}
