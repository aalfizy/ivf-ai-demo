import type { DocumentType, ExtractedFileData } from "./types";

/**
 * Mock file analysis from filenames only (deterministic per name).
 * Tags are Arabic-only for on-screen copy.
 *
 * PRIVACY CONTRACT
 *   The raw filename never leaves this module towards any rendered UI.
 *   Every detection carries an inferred `documentType` ({ar,en}) that is
 *   the ONLY label the report layer is allowed to display. See
 *   `inferDocumentType` below for the canonical mapping.
 */
export function analyzeFiles(filenames: string[]): ExtractedFileData {
  const out: ExtractedFileData = { detections: [] };

  for (const name of filenames) {
    const tags: string[] = [];
    const n = name.toLowerCase();

    if (/\bamh\b|anti.?mullerian|انتي\s*مولر|amh-|amh_/.test(n)) {
      out.amh = pseudoNumber(name + "-amh", 0.6, 4.2, 1);
      tags.push(`هرمون مخزون المبيض تقريباً ${out.amh}`);
    }
    if (/\bfsh\b|fsh-|fsh_/.test(n)) {
      out.fsh = pseudoNumber(name + "-fsh", 4, 12, 1);
      out.hormonal = true;
      tags.push(`هرمون منشّط الجريب تقريباً ${out.fsh}`);
    }
    if (/\blh\b|estradiol|prolactin|tsh|hormone|هرمون/.test(n)) {
      out.hormonal = true;
      if (!tags.length) tags.push("ملف هرمونات");
    }
    if (/pcos|polycystic|تكيس/.test(n)) {
      out.pcos = true;
      tags.push("تأكيد تكيس مبايض");
    }
    if (/ultras|sonar|سونار|echo|scan|اشعه|أشعة|tvs|doppler/.test(n)) {
      out.ultrasound = true;
      tags.push("سونار");
    }
    if (/semen|sperm|سائل\s*منوي|سائل-منوي|male-factor/.test(n)) {
      out.semenAnalysis = true;
      out.spermMotility = pseudoNumber(name + "-mot", 30, 75, 0);
      out.spermConcentration = pseudoNumber(name + "-conc", 8, 55, 0);
      tags.push(
        `تحليل سائل منوي — حركة تقريبية ${out.spermMotility}٪، تركيز تقريبي ${out.spermConcentration} مليون/مل`
      );
    }
    if (/beta|hcg|pregnan|حمل|pregtest/.test(n)) {
      out.pregnancyTest = true;
      tags.push("اختبار حمل");
    }
    if (/thyroid|tsh|غده|غدة|درقي/.test(n)) {
      out.thyroid = true;
      tags.push("وظائف غدة درقية");
    }
    if (/\bcbc\b|complete.?blood|blood.?count|صورة.?دم/.test(n)) {
      if (!tags.length) tags.push("صورة دم كاملة");
    }
    if (tags.length === 0) tags.push("تقرير عام");

    out.detections.push({
      filename: name,
      documentType: inferDocumentType(name),
      tags,
    });
  }

  return out;
}

/**
 * Map a raw upload filename to a privacy-preserving document type
 * label. Order matters — more specific matches come first. This is the
 * only function in the codebase allowed to interpret the filename for
 * labelling purposes.
 */
export function inferDocumentType(filename: string): DocumentType {
  const n = filename.toLowerCase();

  if (/\bamh\b|anti.?mullerian|انتي\s*مولر/.test(n)) {
    return { ar: "تحليل مخزون المبيض (AMH)", en: "Ovarian Reserve (AMH)" };
  }
  if (/semen|sperm|سائل\s*منوي|سائل-منوي|male.?factor/.test(n)) {
    return { ar: "تحليل السائل المنوي", en: "Semen Analysis Report" };
  }
  if (/\bcbc\b|complete.?blood|blood.?count|صورة.?دم/.test(n)) {
    return {
      ar: "صورة دم كاملة (CBC)",
      en: "Complete Blood Count (CBC)",
    };
  }
  if (/beta|\bhcg\b|pregnan|pregtest|حمل/.test(n)) {
    return { ar: "تحليل هرمون الحمل (β-hCG)", en: "Pregnancy Test (β-hCG)" };
  }
  if (/thyroid|\btsh\b|غده|غدة|درقي/.test(n)) {
    return { ar: "تحاليل الغدة الدرقية", en: "Thyroid Function Tests" };
  }
  if (/pcos|polycystic|تكيس/.test(n)) {
    return { ar: "تقرير تكيس المبايض (PCOS)", en: "PCOS Report" };
  }
  if (/hsg|hystero|salpingo|أشعة\s*صبغة/.test(n)) {
    return {
      ar: "أشعة صبغة على الرحم (HSG)",
      en: "Hysterosalpingography (HSG)",
    };
  }
  if (/ultras|sonar|سونار|echo|scan|اشعه|أشعة|tvs|doppler/.test(n)) {
    return { ar: "تقرير أشعة سونار", en: "Ultrasound Report" };
  }
  if (/\bfsh\b|\blh\b|estradiol|prolactin|hormone|هرمون/.test(n)) {
    return { ar: "تقييم هرموني شامل", en: "Hormonal Assessment Report" };
  }
  if (/biopsy|عينة\s*نسيج|histo/.test(n)) {
    return { ar: "تقرير عينة (Biopsy)", en: "Biopsy Report" };
  }
  if (/karyo|chromosome|نوع\s*صبغي/.test(n)) {
    return { ar: "تحليل النوع الصبغي", en: "Karyotype Analysis" };
  }
  if (/glucose|hba1c|سكر/.test(n)) {
    return { ar: "تحاليل السكر", en: "Glucose / HbA1c" };
  }
  if (/vitamin|فيتامين/.test(n)) {
    return { ar: "تحاليل فيتامينات", en: "Vitamin Panel" };
  }

  return { ar: "تقرير طبي مرفق", en: "Medical Report" };
}

/**
 * De-duplicate document types by their English key, preserving order
 * of first appearance. Used by the report layer to render the
 * "Clinical Documents Reviewed" section without showing duplicates
 * when the patient uploads several files of the same kind.
 */
export function uniqueDocumentTypes(types: DocumentType[]): DocumentType[] {
  const seen = new Set<string>();
  const out: DocumentType[] = [];
  for (const t of types) {
    const key = t.en;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Stable hash → number in [min, max] with the requested decimals.
 * Same filename always produces the same value.
 */
function pseudoNumber(seed: string, min: number, max: number, decimals: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const r = (h >>> 0) / 0xffffffff;
  const v = min + r * (max - min);
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}
