import type {
  Answers,
  ConfidenceLevel,
  ExtractedFileData,
  PredictionResult,
} from "./types";
import { analyzeFiles, uniqueDocumentTypes } from "./fileAnalysis";

/**
 * Rule-based "fake AI" prediction engine.
 * Combines self-reported answers with mock-extracted file data,
 * and adjusts the prediction *and* the confidence interval based on
 * how much corroborating evidence we have.
 *
 * NOT medical advice — demo only.
 */
export function predict(
  inputAnswers: Answers,
  fileData?: ExtractedFileData
): PredictionResult {
  const files = inputAnswers.uploaded_files ?? [];
  const fd: ExtractedFileData = fileData ?? analyzeFiles(files);

  // Merge file-extracted facts back into answers (file values fill gaps).
  const a: Answers = { ...inputAnswers };
  if (fd.amh !== undefined && (a.amh === undefined || a.amh === "unknown")) {
    a.amh = fd.amh;
  }
  if (fd.pcos) {
    a.pcos = true;
    a.hormonal_issues = true;
  }
  if (fd.hormonal && a.hormonal_issues === undefined) {
    a.hormonal_issues = true;
  }

  let base = 55;
  const contributingFactors: string[] = [];
  const riskFactors: string[] = [];
  const tests: string[] = [];
  const nextSteps: string[] = [];

  // --- Age ---
  if (a.age !== undefined) {
    if (a.age < 30) {
      base += 12;
      contributingFactors.push("السن أقل من 30 سنة — عامل إيجابي قوي");
    } else if (a.age < 35) {
      base += 6;
      contributingFactors.push("السن في نطاق جيد (أقل من 35)");
    } else if (a.age < 38) {
      base -= 2;
      contributingFactors.push("السن في نطاق مقبول (35-37)");
    } else if (a.age < 40) {
      base -= 10;
      riskFactors.push("السن فوق 37 — يقلل نسبة النجاح نسبياً");
    } else if (a.age < 43) {
      base -= 18;
      riskFactors.push("السن فوق 40 — تأثير واضح على جودة البويضات");
    } else {
      base -= 25;
      riskFactors.push("السن فوق 42 — يفضل مناقشة كل الخيارات مع الطبيب");
    }
  }

  // --- Duration ---
  if (a.duration_years !== undefined) {
    if (a.duration_years >= 5) {
      base -= 6;
      riskFactors.push("مدة المحاولة طويلة (5 سنوات أو أكثر)");
    } else if (a.duration_years >= 3) {
      base -= 3;
      contributingFactors.push("مدة المحاولة متوسطة");
    } else {
      contributingFactors.push("مدة المحاولة قصيرة نسبياً");
    }
  }

  // --- Cycle ---
  if (a.cycle_regular === false) {
    base -= 5;
    riskFactors.push("عدم انتظام الدورة الشهرية");
    tests.push(
      "تحليل هرمونات شامل: المنشّط للجريب، اللوتين، الإسترادايول، البرولاكتين، والغدة الدرقية"
    );
  } else if (a.cycle_regular === true) {
    base += 2;
    contributingFactors.push("انتظام الدورة الشهرية — مؤشر جيد");
  }

  // --- Hormonal / PCOS ---
  if (a.pcos) {
    base -= 4;
    riskFactors.push("تكيس المبايض — يحتاج بروتوكول مخصص");
    tests.push("متابعة مقاومة الإنسولين والسكر التراكمي");
  } else if (a.hormonal_issues) {
    base -= 3;
    riskFactors.push("وجود مشاكل هرمونية — تحتاج متابعة");
  }

  // --- AMH ---
  if (typeof a.amh === "number") {
    if (a.amh < 1) {
      base -= 12;
      riskFactors.push(`مخزون المبيض منخفض (القيمة ≈ ${a.amh})`);
    } else if (a.amh < 1.5) {
      base -= 6;
      riskFactors.push(`مخزون المبيض أقل من المتوسط (القيمة ≈ ${a.amh})`);
    } else if (a.amh <= 4) {
      base += 4;
      contributingFactors.push(`مخزون المبيض جيد (القيمة ≈ ${a.amh})`);
    } else {
      base -= 2;
      riskFactors.push(`مخزون المبيض مرتفع نسبياً (${a.amh}) — قد يشير لتكيس`);
    }
  } else if (a.amh === "unknown") {
    tests.push("تحليل مخزون المبيض (هرمون مقاومة مولر)");
  }

  // --- Previous IVF ---
  if (a.previous_ivf_count !== undefined) {
    if (a.previous_ivf_count === 0) {
      base += 3;
      contributingFactors.push("أول محاولة حقن مجهري");
    } else if (a.previous_ivf_count === 1) {
      base -= 2;
      contributingFactors.push("محاولة سابقة واحدة");
    } else if (a.previous_ivf_count === 2) {
      base -= 6;
      riskFactors.push("محاولتان سابقتان — يُنصح بمراجعة البروتوكول");
    } else {
      base -= 10;
      riskFactors.push(
        `${a.previous_ivf_count} محاولات سابقة — تحتاج تقييم دقيق`
      );
      tests.push("فحص النوع الصبغي لكلا الزوجين");
    }
  }

  // --- Previous pregnancy ---
  if (a.previous_pregnancy) {
    base += 5;
    contributingFactors.push("حصل حمل سابق — مؤشر إيجابي");
  }

  // --- Male factor (self-reported) ---
  if (a.male_factor) {
    base -= 5;
    riskFactors.push("وجود عامل ذكري — يحتاج تقييم الحيوانات المنوية");
    tests.push("تحليل سائل منوي وفحص تجزئة الحمض النووي للحيوانات المنوية");
  } else if (a.male_factor === false) {
    contributingFactors.push("لا يوجد عامل ذكري معروف");
  }

  // --- File-driven adjustments ---
  if (fd.semenAnalysis && fd.spermMotility !== undefined) {
    if (fd.spermMotility < 40) {
      base -= 4;
      riskFactors.push(
        `تحليل السائل المنوي يظهر حركة منخفضة (${fd.spermMotility}%)`
      );
    } else {
      base += 2;
      contributingFactors.push(
        `تحليل السائل المنوي ضمن المعدل (حركة ${fd.spermMotility}%)`
      );
    }
  }
  if (fd.ultrasound) {
    contributingFactors.push("تم رفع تقرير سونار — يساعد في دقة التقييم");
  }
  if (fd.thyroid) {
    contributingFactors.push("تم رفع تحاليل الغدة الدرقية");
  }
  if (fd.pregnancyTest) {
    contributingFactors.push("تم رفع نتيجة اختبار حمل");
  }
  if (fd.fsh !== undefined) {
    if (fd.fsh > 10) {
      base -= 3;
      riskFactors.push(
        `هرمون المنشّط للجريب مرتفع (${fd.fsh}) — مؤشر تحفظي على المخزون`
      );
    } else {
      contributingFactors.push(`هرمون المنشّط للجريب ضمن المعدل (${fd.fsh})`);
    }
  }

  // --- Always-suggested baseline tests ---
  pushUnique(tests, "سونار مهبلي لتقييم الرحم والمبايض");
  pushUnique(
    tests,
    "تحليل هرمونات شامل: المنشّط للجريب، اللوتين، الإسترادايول، البرولاكتين، والغدة الدرقية"
  );
  if (!a.male_factor) pushUnique(tests, "تحليل سائل منوي للزوج");

  // --- Confidence based on evidence ---
  const fileCount = files.length;
  let confidence: ConfidenceLevel;
  let spread: number;
  if (fileCount === 0) {
    confidence = "low";
    spread = 18;
  } else if (fileCount <= 2) {
    confidence = "medium";
    spread = 11;
  } else {
    confidence = "high";
    spread = 7;
  }

  // --- Categorize (kept internally; UI no longer surfaces percentages) ---
  const mid = clamp(base, 15, 85);
  const low = clamp(Math.round(mid - spread), 8, 90);
  const high = clamp(Math.round(mid + spread), 12, 92);

  let category: PredictionResult["category"] = "متوسطة";
  if (mid < 30) category = "منخفضة";
  else if (mid < 50) category = "متوسطة";
  else if (mid < 70) category = "جيدة";
  else category = "مرتفعة";

  // --- Data sufficiency & missing investigations ---
  const hasNumericAmh = typeof a.amh === "number";
  const dataSufficient = fileCount > 0 || hasNumericAmh;

  const missingData: string[] = [];
  if (!hasNumericAmh && !fd.amh) {
    missingData.push("تحليل مخزون المبيض (هرمون مقاومة مولر)");
  }
  if (!fd.hormonal && fd.fsh === undefined) {
    missingData.push(
      "تحليل هرمونات شامل (المنشّط للجريب، اللوتين، الإسترادايول، البرولاكتين، والغدة الدرقية)"
    );
  }
  if (!fd.semenAnalysis) {
    missingData.push("تحليل سائل منوي للزوج");
  }
  if (!fd.ultrasound) {
    missingData.push("سونار مهبلي حديث لتقييم الرحم والمبايض");
  }

  // --- Value-driven next steps (always present, supportive tone) ---
  if (!dataSufficient) {
    nextSteps.push(
      "نبدأ بعمل التحاليل الأساسية المذكورة... دي اللي تساعد في توضيح المسار العلاجي المناسب"
    );
    nextSteps.push(
      "بعد جاهزية النتائج... نقدر نناقش مع طبيب أمراض النساء والعقم خطة عملية ومناسبة لحالتك"
    );
    nextSteps.push(
      "تواصلي مع فريق المركز باستخدام رقم التقرير المرجعي لتسهيل حجز الفحوصات"
    );
  } else {
    nextSteps.push(
      "حجز معاد مع طبيب أمراض النساء والعقم لمراجعة التقرير ومناقشة الخطوات العملية"
    );
    if (missingData.length > 0) {
      nextSteps.push(
        "استكمال التحاليل المتبقية المذكورة... هتساعد في تحديد الخطة بشكل أدق"
      );
    }
    if (riskFactors.length >= 3) {
      nextSteps.push(
        "نناقش بروتوكول علاج مخصص بناءً على العوامل اللي اتذكرت في التقرير"
      );
    }
  }
  nextSteps.push(
    "الحفاظ على نمط حياة صحي: أكل متوازن، نوم كافي، تقليل التوتر"
  );
  if (a.age !== undefined && a.age >= 38) {
    nextSteps.push(
      "مناقشة خيار تجميد البويضات أو فحص الأجنة جينياً قبل الزرع كخيارات داعمة"
    );
  }

  // --- Summary ---
  const summaryParts: string[] = [];
  if (a.age !== undefined) summaryParts.push(`عمر ${a.age} سنة`);
  if (a.duration_years !== undefined)
    summaryParts.push(`محاولة حمل ${a.duration_years} سنة`);
  if (a.cycle_regular === true) summaryParts.push("دورة منتظمة");
  else if (a.cycle_regular === false) summaryParts.push("دورة غير منتظمة");
  if (a.pcos) summaryParts.push("تكيس مبايض");
  if (typeof a.amh === "number")
    summaryParts.push(`مخزون مبيض تقريباً ${a.amh}`);
  if (a.previous_ivf_count && a.previous_ivf_count > 0)
    summaryParts.push(`${a.previous_ivf_count} محاولة سابقة`);
  if (a.previous_pregnancy) summaryParts.push("حمل سابق");
  if (a.male_factor) summaryParts.push("عامل ذكري");
  if (fileCount > 0) summaryParts.push(`${fileCount} ملف مرفوع`);

  const summary =
    summaryParts.length > 0
      ? summaryParts.join("، ") + "."
      : "لم يتم تسجيل بيانات كافية.";

  // When investigations are missing, the report must not present any
  // assessment, impression, or success indication. We blank out the
  // narrative factors so the UI shows the missing-data view instead.
  const safeContributing = dataSufficient ? contributingFactors : [];
  const safeRisks = dataSufficient ? riskFactors : [];

  return {
    low,
    high,
    mid,
    category,
    confidence,
    contributingFactors: safeContributing,
    riskFactors: safeRisks,
    suggestedTests: tests,
    nextSteps,
    summary,
    fileFindings: fd.detections,
    reviewedDocuments: uniqueDocumentTypes(
      fd.detections.map((d) => d.documentType)
    ),
    dataSufficient,
    missingData,
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function pushUnique<T>(arr: T[], item: T) {
  if (!arr.includes(item)) arr.push(item);
}
