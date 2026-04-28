/**
 * Arabic-aware, tolerant NLU helpers.
 * We accept both Arabic and English numerals and common Egyptian phrasings.
 */

const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

// Simple Arabic number words -> digits (0-40 covers realistic ages/durations)
const ARABIC_NUMBER_WORDS: Record<string, number> = {
  صفر: 0,
  "واحد": 1,
  "واحدة": 1,
  "اتنين": 2,
  "إتنين": 2,
  "اثنين": 2,
  "تلاتة": 3,
  "ثلاثة": 3,
  "تلات": 3,
  "اربعة": 4,
  "أربعة": 4,
  "اربع": 4,
  "خمسة": 5,
  "خمس": 5,
  "ستة": 6,
  "ست": 6,
  "سبعة": 7,
  "سبع": 7,
  "تمانية": 8,
  "ثمانية": 8,
  "تمان": 8,
  "تسعة": 9,
  "تسع": 9,
  "عشرة": 10,
  "عشر": 10,
  "حداشر": 11,
  "احدعشر": 11,
  "اتناشر": 12,
  "اثنا عشر": 12,
  "تلتاشر": 13,
  "اربعتاشر": 14,
  "خمستاشر": 15,
  "ستاشر": 16,
  "سبعتاشر": 17,
  "تمنتاشر": 18,
  "تسعتاشر": 19,
  "عشرين": 20,
  "خمسة وعشرين": 25,
  "تلاتين": 30,
  "ثلاثين": 30,
  "اربعين": 40,
  "أربعين": 40,
  "خمسين": 50,
};

export function normalize(text: string): string {
  let t = text.trim();
  // Normalize Arabic digits to Latin
  t = t.replace(/[٠-٩]/g, (d) => ARABIC_DIGITS[d] ?? d);
  // Normalize alefs / yaa / taa marbouta for matching
  t = t
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return t;
}

export function extractNumber(text: string): number | null {
  const t = normalize(text);
  const m = t.match(/-?\d+(\.\d+)?/);
  if (m) return parseFloat(m[0]);

  // Try Arabic word numbers
  for (const [word, value] of Object.entries(ARABIC_NUMBER_WORDS)) {
    const norm = normalize(word);
    if (t.includes(norm)) return value;
  }
  return null;
}

const YES_WORDS = [
  "نعم",
  "ايوه",
  "اه",
  "أيوة",
  "ايوة",
  "اكيد",
  "أكيد",
  "صح",
  "تمام",
  "موجود",
  "موجودة",
  "في",
  "فيه",
  "yes",
  "yeah",
  "yep",
  "sure",
  "ok",
];

const NO_WORDS = [
  "لا",
  "لأ",
  "مش",
  "لسه لا",
  "ابدا",
  "أبداً",
  "مفيش",
  "ما فيش",
  "مش موجود",
  "مش موجودة",
  "no",
  "nope",
];

const UNKNOWN_WORDS = [
  "مش عارفة",
  "مش عارف",
  "معرفش",
  "ما اعرفش",
  "لا اعرف",
  "مش متأكدة",
  "مش متاكده",
  "مش متاكد",
  "مش فاكرة",
  "مش فاكر",
  "idk",
  "unknown",
  "not sure",
];

export function isYes(text: string): boolean {
  const t = normalize(text);
  return YES_WORDS.some((w) => t.includes(normalize(w)));
}

export function isNo(text: string): boolean {
  const t = normalize(text);
  return NO_WORDS.some((w) => t.includes(normalize(w)));
}

export function isUnknown(text: string): boolean {
  const t = normalize(text);
  return UNKNOWN_WORDS.some((w) => t.includes(normalize(w)));
}

export function classifyYesNo(
  text: string
): "yes" | "no" | "unknown" | "unclear" {
  if (isUnknown(text)) return "unknown";
  // "لا" appears inside many words, so check NO first with word boundaries if possible
  if (isNo(text) && !isYes(text)) return "no";
  if (isYes(text) && !isNo(text)) return "yes";
  if (isYes(text)) return "yes";
  if (isNo(text)) return "no";
  return "unclear";
}

export function containsAny(text: string, words: string[]): boolean {
  const t = normalize(text);
  return words.some((w) => t.includes(normalize(w)));
}

const DONE_UPLOADING_WORDS = [
  "خلصت",
  "خلصنا",
  "كده تمام",
  "كده كفايه",
  "كفايه كده",
  "كفاية كده",
  "مفيش تاني",
  "ما فيش تاني",
  "بس كده",
  "خلاص",
  "خلاص كده",
  "تم",
  "انتهيت",
  "im done",
  "done",
  "finished",
  "that's all",
  "thats all",
  "no more",
];

const WANT_TO_UPLOAD_WORDS = [
  "هرفع",
  "ها رفع",
  "حرفع",
  "هحمل",
  "هاحمل",
  "ارفع",
  "أرفع",
  "حمل",
  "تحميل",
  "upload",
];

export function isDoneUploading(text: string): boolean {
  const t = normalize(text);
  return DONE_UPLOADING_WORDS.some((w) => t.includes(normalize(w)));
}

export function wantsToUpload(text: string): boolean {
  const t = normalize(text);
  return WANT_TO_UPLOAD_WORDS.some((w) => t.includes(normalize(w)));
}
