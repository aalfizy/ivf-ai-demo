import type { SpeakerRole } from "./types";

/**
 * On-screen text that adapts to the detected speaker role.
 *
 * Conventions:
 *   - "wife"     → addresses the user with feminine 2nd-person.
 *   - "husband"  → addresses the user with masculine 2nd-person.
 *   - "unknown"  → uses neutral colloquial plural (matches the
 *                  same plural forms used in `intro()` of conversation.ts).
 *
 * No formal MSA, no dual-gender slashes (e.g. "اضغط/ي"). The same tone
 * that's used in the conversation flow is preserved here so the
 * written and spoken layers feel consistent.
 */

type RoleVariants = { wife: string; husband: string; unknown: string };

function pick(role: SpeakerRole, v: RoleVariants): string {
  if (role === "wife") return v.wife;
  if (role === "husband") return v.husband;
  return v.unknown;
}

// ───────────────────────── initial screen ─────────────────────────

/**
 * Shown only before the session starts — the role isn't known yet,
 * so this is always neutral plural and lives outside `pick()`.
 */
export const introInstruction =
  "اضغطوا على الميكروفون وهنسأل كام سؤال بسيط بالصوت... وفي الآخر هنطلّع تقرير مبدئي.";

export const introHeadline = "تقييم مبدئي للحقن المجهري";

// ───────────────────────── error messages ─────────────────────────

export const micPermissionDenied = (role: SpeakerRole) =>
  pick(role, {
    wife: "مش قادرين نوصل للميكروفون. من فضلك اسمحي للموقع باستخدام الميكروفون.",
    husband: "مش قادرين نوصل للميكروفون. من فضلك اسمح للموقع باستخدام الميكروفون.",
    unknown: "مش قادرين نوصل للميكروفون. من فضلكم اسمحوا للموقع باستخدام الميكروفون.",
  });

export const micGenericError = (role: SpeakerRole) =>
  pick(role, {
    wife: "حصلت مشكلة في الاستماع. جربي تاني.",
    husband: "حصلت مشكلة في الاستماع. جرب تاني.",
    unknown: "حصلت مشكلة في الاستماع. جربوا تاني.",
  });

export const speechNotSupported = (role: SpeakerRole) =>
  pick(role, {
    wife: "المتصفح ده مش بيدعم التعرف على الصوت. جرّبي Google Chrome أو Edge على كمبيوتر أو أندرويد.",
    husband: "المتصفح ده مش بيدعم التعرف على الصوت. جرّب Google Chrome أو Edge على كمبيوتر أو أندرويد.",
    unknown: "المتصفح ده مش بيدعم التعرف على الصوت. جرّبوا Google Chrome أو Edge على كمبيوتر أو أندرويد.",
  });

// ───────────────────────── orb labels ─────────────────────────

export const orbIdleLabel = (role: SpeakerRole) =>
  pick(role, {
    wife: "اضغطي علشان تبدأي الكلام",
    husband: "اضغط علشان تبدأ الكلام",
    unknown: "اضغطوا علشان نبدأ الكلام",
  });

export const orbSpeakingLabel = (role: SpeakerRole) =>
  pick(role, {
    wife: "بترد عليكي…",
    husband: "بترد عليك…",
    unknown: "بترد عليكم…",
  });

export const orbListeningLabel = "بتسمعك دلوقتي…";
export const orbThinkingLabel = "بتفكر…";

// ───────────────────────── file upload ─────────────────────────

export const fileUploadTitle = (role: SpeakerRole, highlighted: boolean) =>
  pick(role, {
    wife: highlighted
      ? "ارفعي تحاليلك هنا — هتساعد في تقييم أدق"
      : "ارفعي تحاليل أو تقارير (اختياري)",
    husband: highlighted
      ? "ارفع التحاليل هنا — هتساعد في تقييم أدق"
      : "ارفع تحاليل أو تقارير (اختياري)",
    unknown: highlighted
      ? "ارفعوا التحاليل هنا — هتساعد في تقييم أدق"
      : "ارفعوا تحاليل أو تقارير (اختياري)",
  });

export const fileUploadHelp = (role: SpeakerRole) =>
  pick(role, {
    wife: "PDF أو صورة. تقدري ترفعي أكتر من ملف، ولما تخلصي قولي خلصت.",
    husband: "PDF أو صورة. تقدر ترفع أكتر من ملف، ولما تخلص قول خلصت.",
    unknown: "PDF أو صورة. تقدروا ترفعوا أكتر من ملف، ولما تخلصوا قولوا خلصت.",
  });

export const fileUploadChooseLabel = (
  role: SpeakerRole,
  highlighted: boolean
) =>
  highlighted
    ? pick(role, {
        wife: "اختاري ملف",
        husband: "اختار ملف",
        unknown: "اختاروا ملف",
      })
    : "اختيار";

// ───────────────────────── upload hint inside session ─────────────────────────

export const uploadHintEmpty = (role: SpeakerRole) =>
  pick(role, {
    wife: "لو عندك تحاليل أو أشعة، ارفعيها دلوقتي ◆ هترفع دقة التقييم.",
    husband: "لو عندك تحاليل أو أشعة، ارفعها دلوقتي ◆ هترفع دقة التقييم.",
    unknown: "لو عندكم تحاليل أو أشعة، ارفعوها دلوقتي ◆ هترفع دقة التقييم.",
  });

export const uploadHintReceived = (role: SpeakerRole, count: number) =>
  pick(role, {
    wife: `استلمت ${count} ملف. تقدري ترفعي تاني، ولما تخلصي قولي "خلصت".`,
    husband: `استلمت ${count} ملف. تقدر ترفع تاني، ولما تخلص قول "خلصت".`,
    unknown: `استلمت ${count} ملف. تقدروا ترفعوا تاني، ولما تخلصوا قولوا "خلصت".`,
  });

// ───────────────────────── hope note ─────────────────────────

export const hopeIntroTitle = (role: SpeakerRole) =>
  pick(role, {
    wife: "خدتي أول خطوة، وده اللي مهم",
    husband: "خدت أول خطوة، وده اللي مهم",
    unknown: "خدتوا أول خطوة، وده اللي مهم",
  });

export const hopeIntroBody = (role: SpeakerRole) =>
  pick(role, {
    wife: "كل رحلة بتبدأ بقرار، وأنتي اتخدتيه. التقرير ده مجرد بداية، والفريق هنا معاكي خطوة بخطوة. يا رب يكون الخبر القادم خير وفرحة.",
    husband: "كل رحلة بتبدأ بقرار، وأنت اتخدته. التقرير ده مجرد بداية، والفريق هنا معاكم خطوة بخطوة. يا رب يكون الخبر القادم خير وفرحة.",
    unknown: "كل رحلة بتبدأ بقرار، وأنتم اتخدتوه. التقرير ده مجرد بداية، والفريق هنا معاكم خطوة بخطوة. يا رب يكون الخبر القادم خير وفرحة.",
  });

export const hopeClosingTitle = "ربنا يقدّر اللي فيه الخير";

export const hopeClosingBody = (role: SpeakerRole) =>
  pick(role, {
    wife: "فريق المركز هيتواصل معاكي قريب. خدي وقتك في الراحة، واعتني بنفسك. إحنا معاكي خطوة بخطوة.",
    husband: "فريق المركز هيتواصل معاك قريب. خد وقتك في الراحة، واعتني بنفسك. إحنا معاك خطوة بخطوة.",
    unknown: "فريق المركز هيتواصل معاكم قريب. خدوا وقتكم في الراحة، واعتنوا بنفسكم. إحنا معاكم خطوة بخطوة.",
  });

// ───────────────────────── report view ─────────────────────────

export const noSessionMessage = "ماعندناش بيانات جلسة لسه.";

export const startSessionLabel = (role: SpeakerRole) =>
  pick(role, {
    wife: "ابدئي الجلسة",
    husband: "ابدأ الجلسة",
    unknown: "ابدأوا الجلسة",
  });

export const referenceIdNoteText = (role: SpeakerRole) =>
  pick(role, {
    wife:
      "تم استخدام رقم مرجعي للتقرير في الأعلى بدل أي بيانات شخصية، حفاظاً على الخصوصية. " +
      "تقدري تستخدمي هذا الرقم عند التواصل مع الفريق الطبي للرجوع لنفس التقرير من غير الحاجة لمشاركة معلومات إضافية.",
    husband:
      "تم استخدام رقم مرجعي للتقرير في الأعلى بدل أي بيانات شخصية، حفاظاً على الخصوصية. " +
      "تقدر تستخدم هذا الرقم عند التواصل مع الفريق الطبي للرجوع لنفس التقرير من غير الحاجة لمشاركة معلومات إضافية.",
    unknown:
      "تم استخدام رقم مرجعي للتقرير في الأعلى بدل أي بيانات شخصية، حفاظاً على الخصوصية. " +
      "تقدروا تستخدموا هذا الرقم عند التواصل مع الفريق الطبي للرجوع لنفس التقرير من غير الحاجة لمشاركة معلومات إضافية.",
  });
