"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BrandingLogo from "@/components/BrandingLogo";
import {
  clearSession,
  loadSession,
  type SessionData,
} from "@/lib/session";
import { predict } from "@/lib/prediction";
import type {
  Answers,
  ConfidenceLevel,
  PredictionResult,
  SpeakerRole,
} from "@/lib/types";
import HopeNote from "./HopeNote";
import {
  noSessionMessage,
  referenceIdNoteText,
  startSessionLabel,
} from "@/lib/uiPhrasing";

export default function ReportView() {
  const [data, setData] = useState<SessionData | null>(null);

  useEffect(() => {
    setData(loadSession());
  }, []);

  const prediction = useMemo(() => {
    if (!data) return null;
    return data.prediction ?? predict(data.answers ?? {});
  }, [data]);

  const reportYear = new Date().getFullYear();
  const referenceId = useMemo(
    () => stableReportReference(reportYear, data?.completedAt),
    [reportYear, data?.completedAt]
  );

  if (!data) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-4">
        <div className="flex justify-start print:hidden">
          <BrandingLogo variant="inline" />
        </div>
        <div className="glass rounded-3xl p-8 text-center shadow-soft">
          <p className="text-ink-600">{noSessionMessage}</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xl bg-brand-600 text-white px-4 py-2 text-sm hover:bg-brand-700 transition"
          >
            {startSessionLabel("unknown")}
          </Link>
        </div>
      </div>
    );
  }

  const a = data.answers ?? {};
  const p = prediction!;
  const role: SpeakerRole = a.speakerRole ?? "unknown";

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  const handleNew = () => {
    clearSession();
    if (typeof window !== "undefined") window.location.href = "/";
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BrandingLogo variant="inline" />
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="text-sm text-ink-500 hover:text-ink-800 transition"
          >
            ← رجوع
          </Link>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-xl border border-ink-200 bg-white/80 px-3 py-2 text-xs text-ink-700 hover:bg-white transition"
          >
            طباعة / PDF
          </button>
          <button
            type="button"
            onClick={handleNew}
            className="rounded-xl border border-ink-200 bg-white/80 px-3 py-2 text-xs text-ink-700 hover:bg-white transition"
          >
            جلسة جديدة
          </button>
        </div>
      </div>

      <article className="glass rounded-3xl p-6 sm:p-10 shadow-soft animate-fade-in-up print:shadow-none print:bg-white">
        <ReportHeader referenceId={referenceId} />

        <NoSaveWarning />

        <div className="mb-6">
          <HopeNote variant="intro" role={role} />
        </div>

        <PredictionHero prediction={p} />

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

        {!p.dataSufficient && p.missingData.length > 0 && (
          <Section title="بيانات أو تحاليل غير متوفرة">
            <p className="text-ink-700 leading-7 mb-3">
              البيانات المتاحة حالياً غير كافية لتقديم تقييم تفصيلي. النقاط
              التالية لو اتوفرت هتساعد في توضيح المسار العلاجي المناسب:
            </p>
            <ul className="space-y-2">
              {p.missingData.map((m, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl bg-white/80 border border-ink-100 px-4 py-2 text-ink-700"
                >
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-ink-400 shrink-0" />
                  <span className="leading-7">{m}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {p.dataSufficient && p.riskFactors.length > 0 && (
          <Section title="ملاحظات تستدعي الانتباه">
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

        {p.dataSufficient && p.contributingFactors.length > 0 && (
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

        <ReferenceIdNote role={role} />

        <Disclaimer />

        <div className="mt-8 print:hidden">
          <CompletionActions
            referenceId={referenceId}
            onDownload={handlePrint}
            role={role}
          />
        </div>
      </article>
    </div>
  );
}

function ReportHeader({ referenceId }: { referenceId: string }) {
  const today = new Date();
  const date = today.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <header className="flex items-start justify-between gap-4 border-b border-ink-100 pb-5 mb-6">
      <div>
        <p className="text-[11px] tracking-widest text-brand-700">
          تقرير تقييم مبدئي للحقن المجهري
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-ink-900">
          التقرير المبدئي للحقن المجهري
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          تاريخ التقرير: {date} · مرجع: {referenceId}
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

/** Deterministic reference code from session completion time (no random IDs). */
function stableReportReference(year: number, completedAt?: number): string {
  let x = (completedAt ?? 0) ^ year;
  x = Math.imul(x, 0x9e3779b1);
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  const code = String((x >>> 0) % 10_000_000).padStart(7, "0");
  return `حقن-${year}-${code}`;
}

function PredictionHero({ prediction }: { prediction: PredictionResult }) {
  const insufficient = !prediction.dataSufficient;
  const headline = insufficient
    ? "البيانات الحالية غير كافية لتقديم تقييم"
    : "ملخص مبدئي داعم لاتخاذ القرار";
  const body = insufficient
    ? "في الوقت الحالي ما عندناش تحاليل أو فحوصات كافية نعتمد عليها في تقييم الحالة. استكمال النقاط المذكورة في هذا التقرير هيساعد الفريق الطبي يحدد المسار المناسب."
    : "تشير البيانات الأولية إلى مؤشرات يمكن البناء عليها... وتساعد هذه النتائج في توجيه الخطوات القادمة بشكل أدق مع الفريق الطبي.";

  return (
    <div className="relative overflow-hidden rounded-2xl p-6 border border-brand-100 bg-gradient-to-br from-white to-brand-50">
      <p className="text-xs text-brand-700 font-medium">{headline}</p>
      <p className="mt-2 text-ink-800 leading-7 text-sm sm:text-base">{body}</p>
      <div className="mt-3">
        <SupportIndicator
          confidence={prediction.confidence}
          insufficient={insufficient}
        />
      </div>
    </div>
  );
}

/**
 * Soft, non-numeric badge that signals how complete the input was —
 * never a “success rate”. We deliberately avoid words like high/medium/low
 * success and only describe the breadth of available data.
 */
function SupportIndicator({
  confidence,
  insufficient,
}: {
  confidence: ConfidenceLevel;
  insufficient: boolean;
}) {
  if (insufficient) {
    return (
      <span className="inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        بحاجة لاستكمال البيانات
      </span>
    );
  }
  const map = {
    high: {
      label: "البيانات المتوفرة شاملة",
      className: "bg-mint-100 text-mint-700 border-mint-200",
      dot: "bg-mint-500",
    },
    medium: {
      label: "البيانات المتوفرة جزئية",
      className: "bg-brand-50 text-brand-700 border-brand-200",
      dot: "bg-brand-500",
    },
    low: {
      label: "البيانات المتوفرة مبدئية",
      className: "bg-amber-50 text-amber-800 border-amber-200",
      dot: "bg-amber-500",
    },
  } as const;
  const cfg = map[confidence];
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
      label: "تحليل مخزون المبيض",
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
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm leading-7">
      <strong className="block mb-1">تنويه مهم</strong>
      هذا التقرير يهدف لدعم اتخاذ القرار فقط، وما بياخدش أي قرار طبي. القرار
      النهائي مرجعه الفحص السريري والتحاليل الفعلية مع الطبيب المختص.
    </div>
  );
}

function ReferenceIdNote({ role }: { role: SpeakerRole }) {
  return (
    <div className="mt-7 rounded-2xl border border-ink-100 bg-white/70 p-4 text-ink-700 text-sm leading-7">
      <strong className="block mb-1 text-ink-900">الخصوصية ورقم التقرير</strong>
      {referenceIdNoteText(role)}
    </div>
  );
}

/**
 * Subtle one-line warning shown near the top of the report.
 * Reminds the user that nothing is auto-saved.
 */
function NoSaveWarning() {
  return (
    <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-amber-900 text-xs leading-6 print:hidden">
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4" />
        <path d="M12 16h0" />
      </svg>
      <span>
        التقرير لن يتم حفظه تلقائيًا، يُفضل الاحتفاظ به قبل إغلاق الصفحة.
      </span>
    </div>
  );
}

/**
 * End-of-report actions: only TWO. Download (primary) and a WhatsApp
 * deep-link (optional). The WhatsApp link opens the app with a
 * pre-filled message that includes the report reference number — it
 * does NOT auto-send. There is no login, no upload, no backend call.
 */
function CompletionActions({
  referenceId,
  onDownload,
  role,
}: {
  referenceId: string;
  onDownload: () => void;
  role: SpeakerRole;
}) {
  const whatsappHref = useMemo(() => {
    const message =
      `السلام عليكم،\n` +
      `حابب أتواصل بخصوص تقرير التقييم المبدئي للحقن المجهري.\n` +
      `رقم التقرير المرجعي: ${referenceId}\n` +
      `ياريت يتم مراجعة التقرير والتواصل معايا. شكراً.`;
    const phone = (process.env.NEXT_PUBLIC_CLINIC_WHATSAPP ?? "").trim();
    const base = phone
      ? `https://wa.me/${encodeURIComponent(phone)}`
      : `https://wa.me/`;
    return `${base}?text=${encodeURIComponent(message)}`;
  }, [referenceId]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="rounded-2xl border border-brand-100 bg-white/80 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={onDownload}
            className="rounded-xl bg-brand-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-700 transition shadow-soft"
          >
            تحميل التقرير (PDF)
          </button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-mint-200 bg-mint-50 text-mint-800 px-5 py-2.5 text-sm font-medium hover:bg-mint-100 transition"
          >
            <WhatsAppIcon />
            <span>إرسال عبر واتساب</span>
          </a>
        </div>
        <p className="mt-4 text-sm text-ink-700 leading-7">
          يرجى الاحتفاظ بالتقرير أو رقم التقرير قبل إغلاق الصفحة. في حال
          رغبتك في مناقشة التقرير، يمكنك التواصل مع المركز وذكر رقم التقرير،
          أو إرساله عبر واتساب، وسيقوم الفريق الطبي بمراجعته والتواصل معك.
        </p>
      </div>
      <HopeNote variant="closing" role={role} />
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.554-5.338 11.89-11.893 11.89a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.512 5.26l-.999 3.648 3.976-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.149-.173.198-.297.297-.495.099-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.371-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
    </svg>
  );
}
