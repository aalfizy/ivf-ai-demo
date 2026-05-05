import type { SpeakerRole } from "./types";
import { normalize } from "./parsing";

/**
 * Light-weight role inference from Egyptian-Arabic utterances.
 *
 * Design intent:
 *   - We never ask the speaker a blunt "are you the husband or the wife?"
 *     question. Instead, we listen for natural cues across the
 *     conversation and lock the role once a confident cue appears.
 *   - All matching is done on text passed through `normalize()` so that
 *     diacritics, alef variants, and ة/ه differences don't matter.
 *   - The detector is intentionally conservative: ambiguous phrases
 *     return "unknown" so the dialogue stays neutral.
 */

const HUSBAND_CUES: RegExp[] = [
  /(^|\s)مراتي(\s|$|،|\.|؟)/,
  /(^|\s)زوجتي(\s|$|،|\.|؟)/,
  /(^|\s)زوجتى(\s|$|،|\.|؟)/,
  /(^|\s)مراته(\s|$|،|\.|؟)/,
  /\bانا\s+الزوج\b/,
  /\bانا\s+الراجل\b/,
  /\bانا\s+جوز\b/,
  /\bانا\s+جوزها\b/,
  /\bمراتي\s+بتحاول/,
  /\bبحاول\s+مع\s+مراتي\b/,
];

const WIFE_CUES: RegExp[] = [
  /(^|\s)جوزي(\s|$|،|\.|؟)/,
  /(^|\s)زوجي(\s|$|،|\.|؟)/,
  /(^|\s)زوجى(\s|$|،|\.|؟)/,
  /\bانا\s+الزوجه\b/,
  /\bانا\s+الست\b/,
  /\bانا\s+المرات\b/,
  /\bبحاول\s+احمل\b/,
  /\bبحاول\s+اني\s+احمل\b/,
  /\bعايزه\s+احمل\b/,
  /\bعندي\s+تكيس\b/,
  /\bعندي\s+مشكله\s+في\s+الدوره\b/,
  /\bالدوره\s+عندي\b/,
  /\bانا\s+حملت\s+قبل\b/,
];

/**
 * Run cue detection on a single utterance. Returns "unknown" when
 * neither set of cues fires — the caller decides whether to keep the
 * previous role or stay neutral.
 */
export function detectRole(rawText: string): SpeakerRole {
  if (!rawText) return "unknown";
  const t = normalize(rawText);
  const hus = HUSBAND_CUES.some((re) => re.test(t));
  const wif = WIFE_CUES.some((re) => re.test(t));
  // Both cues fired — utterance is genuinely ambiguous (e.g. someone
  // talking in third person about both spouses). Stay neutral.
  if (hus && wif) return "unknown";
  if (hus) return "husband";
  if (wif) return "wife";
  return "unknown";
}

/**
 * Sticky update: once a confident role has been detected we keep it
 * for the rest of the session. New utterances can only PROMOTE the
 * role from "unknown" → "wife"/"husband", never override it.
 */
export function updateRole(
  prev: SpeakerRole | undefined,
  text: string
): SpeakerRole {
  const current = prev ?? "unknown";
  if (current !== "unknown") return current;
  return detectRole(text);
}
