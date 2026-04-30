import type { ExtractedFileData } from "./types";

/**
 * Mock file analysis from filenames only (deterministic per name).
 * Tags are Arabic-only for on-screen copy.
 */
export function analyzeFiles(filenames: string[]): ExtractedFileData {
  const out: ExtractedFileData = { detections: [] };

  for (const name of filenames) {
    const tags: string[] = [];
    const n = name.toLowerCase();

    if (/\bamh\b|انتي\s*مولر|amh-|amh_/.test(n)) {
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
    if (/ultras|sonar|سونار|echo|scan|اشعه|أشعة|tvs/.test(n)) {
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
    if (tags.length === 0) tags.push("تقرير عام");

    out.detections.push({ filename: name, tags });
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
