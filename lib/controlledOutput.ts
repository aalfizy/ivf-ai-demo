/**
 * Light post-processing for assistant output.
 *
 * Goals:
 *   - Keep responses natural and primarily Arabic (Egyptian dialect).
 *   - Strip irrelevant trailing English / hallucinated tail fragments
 *     ONLY when they look out of place (the response is mostly Arabic
 *     and ends with a Latin-only run).
 *   - Never block or replace a real Arabic response.
 *
 * The previous strict validator (full reject + safe fallback) was too
 * aggressive — it killed natural answers when a single Latin token
 * leaked through. This version cleans, it does not censor.
 */

export const ASSISTANT_SAFE_FALLBACK =
  "حصلت مشكلة تقنية بسيطة... من فضلك جرّبي تاني من الأول أو تواصلي مع المركز.";

const ARABIC_SCRIPT =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ARABIC_SCRIPT_GLOBAL =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const LATIN_LETTER = /[A-Za-z]/;

/** Sentence-ish boundaries (Arabic + Latin punctuation, ellipses). */
const SENTENCE_SPLIT = /(?:[.؟!?]+\s+|\s*\u2026\s*|\s*\.{3}\s*)/u;

/** Considered “mostly Arabic” when ≥60% of letter chars are Arabic. */
const ARABIC_DOMINANCE_THRESHOLD = 0.6;

export interface CleanResult {
  text: string;
  cleaned: boolean;
  notes: string[];
}

/** Public: light cleanup, never returns empty unless input is empty. */
export function cleanAssistantText(raw: string): CleanResult {
  const original = (raw ?? "").trim();
  if (!original) return { text: "", cleaned: false, notes: ["empty"] };

  const notes: string[] = [];
  let text = original;

  // 1) Drop common stray model-tail markers (e.g. "<|endoftext|>", "</s>").
  const stripped = stripModelTailMarkers(text);
  if (stripped !== text) {
    notes.push("stripped_model_markers");
    text = stripped;
  }

  // 2) Trim trailing Latin-only sentences when the body is mostly Arabic.
  const trimmed = trimTrailingLatinTail(text);
  if (trimmed !== text) {
    notes.push("trimmed_trailing_latin");
    text = trimmed;
  }

  // 3) When the response is clearly Arabic-dominant, also strip any
  //    remaining standalone English words (purely Latin tokens). Numbers,
  //    punctuation, and Arabic↔Latin mixed tokens are left untouched.
  if (isArabicDominant(text)) {
    const noLatin = stripStandaloneLatinWords(text);
    if (noLatin !== text) {
      notes.push("stripped_inline_latin_words");
      text = noLatin;
    }
  }

  // 4) Collapse repeated whitespace introduced by trimming.
  const collapsed = text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([،,.؟!?…])/g, "$1")
    .trim();
  if (collapsed !== text) text = collapsed;

  return { text, cleaned: text !== original, notes };
}

/** Public wrapper used by UI / TTS. Logs only if the text was changed. */
export function sanitizeAssistantForDisplay(
  raw: string,
  context?: Record<string, unknown>
): string {
  const result = cleanAssistantText(raw);
  if (!result.text) {
    console.warn("[ControlledOutput] empty assistant text → safe fallback", {
      ...context,
    });
    return ASSISTANT_SAFE_FALLBACK;
  }
  if (result.cleaned) {
    console.log("[ControlledOutput] cleaned assistant text", {
      notes: result.notes,
      preview: result.text.slice(0, 160),
      ...context,
    });
  }
  return result.text;
}

/** Backwards-compatible logger (kept so existing imports continue to work). */
export function logUnexpectedAssistantOutput(
  reason: string,
  text: string,
  context?: Record<string, unknown>
): void {
  console.warn("[ControlledOutput] unexpected output", {
    reason,
    preview: text.slice(0, 280),
    length: text.length,
    ...context,
  });
}

// ───────────────────────── helpers ─────────────────────────

function arabicLetterCount(s: string): number {
  return (s.match(ARABIC_SCRIPT_GLOBAL) ?? []).length;
}
function latinLetterCount(s: string): number {
  return (s.match(/[A-Za-z]/g) ?? []).length;
}

function isArabicDominant(s: string): boolean {
  const ar = arabicLetterCount(s);
  const la = latinLetterCount(s);
  const total = ar + la;
  if (total === 0) return false;
  return ar / total >= ARABIC_DOMINANCE_THRESHOLD;
}

/**
 * Drop tokens that are made entirely of Latin letters (e.g. stray English
 * words / hallucinated tail words). Keeps anything containing Arabic
 * script, digits, or mixed content. Whitespace is preserved by working
 * on a regex that matches the whole token boundary.
 */
function stripStandaloneLatinWords(text: string): string {
  return text.replace(/(^|\s)[A-Za-z]+(?=$|\s|[،,.؟!?…])/g, "$1").trim();
}

/**
 * If the text is mostly Arabic but ends with one or more Latin-only
 * sentences (typical hallucinated tail from a model), drop those.
 * Never strips Latin tokens that are interleaved with Arabic — those
 * are likely intentional (numbers, units, proper nouns).
 */
function trimTrailingLatinTail(text: string): string {
  if (!LATIN_LETTER.test(text)) return text;
  if (!isArabicDominant(text)) return text;

  const parts = text.split(SENTENCE_SPLIT);
  if (parts.length <= 1) return text;

  let endIdx = parts.length;
  while (endIdx > 1) {
    const seg = parts[endIdx - 1].trim();
    if (!seg) {
      endIdx -= 1;
      continue;
    }
    const segHasArabic = ARABIC_SCRIPT.test(seg);
    const segHasLatin = LATIN_LETTER.test(seg);
    if (!segHasArabic && segHasLatin) {
      endIdx -= 1;
      continue;
    }
    break;
  }
  if (endIdx === parts.length) return text;

  // Re-stitch using the simplest delimiter; we lose the original separator
  // but downstream TTS already handles its own breaks/SSML.
  return parts.slice(0, endIdx).join(". ").replace(/\s{2,}/g, " ").trim();
}

/** Drop common LLM end-of-stream sentinels if any leaked through. */
function stripModelTailMarkers(text: string): string {
  return text
    .replace(/<\|endoftext\|>/gi, "")
    .replace(/<\/s>/gi, "")
    .replace(/\[\s*end\s*\]/gi, "")
    .trim();
}
