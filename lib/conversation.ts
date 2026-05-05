import type { Answers, SpeakerRole, StepId } from "./types";
import {
  classifyYesNo,
  containsAny,
  extractNumber,
  isDoneUploading,
  isUnknown,
  wantsToUpload,
} from "./parsing";
import { predict } from "./prediction";
import { updateRole } from "./roleInference";

export interface StepResult {
  /** Spoken assistant utterance */
  assistant: string;
  /** Next step id */
  next: StepId;
  /** Updated answers */
  answers: Answers;
  /** True if this is the closing message */
  done?: boolean;
  /** Whether the listener should auto-restart after speaking */
  autoListen?: boolean;
}

/**
 * Natural Egyptian-Arabic acknowledgement variants. We rotate through
 * them so the assistant doesn't sound robotic; all variants are vetted
 * Arabic-only copy.
 */
const ACK = ["تمام", "طيب", "حلو", "ماشي", "تمام كده"] as const;
const randomOf = <T>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]!;
const ack = () => randomOf(ACK);

/**
 * First utterance — open invitation, gender-neutral. We let the
 * speaker introduce themselves freely; role gets inferred from cues
 * in their reply (and any subsequent reply) by `roleInference.ts`.
 */
export function intro(): { text: string; next: StepId } {
  return {
    text:
      "أهلاً بيكم في مساعد المركز الذكي... هساعدكم نِوَضَح صورة أولية عن الحالة. " +
      "احكوا لي في البداية بصوتكم عن سبب التواصل والرحلة بشكل عام... " +
      "أنا بسمعكم بالراحة... وهنمشي مع بعض خَطْوَة بِخَطْوَة.",
    next: "intro",
  };
}

// ───────────────────── role-aware phrasing helpers ─────────────────────

/**
 * Variants per question, indexed by detected role. Picking is random
 * across variants so the assistant feels less scripted, but every
 * variant is vetted Egyptian-Arabic copy. Phrasing addresses the wife
 * directly when she's the speaker, and asks the husband ABOUT his wife
 * when he's the speaker. "unknown" stays neutral.
 */
const QUESTIONS: Partial<Record<StepId, Record<SpeakerRole, string[]>>> = {
  age: {
    wife: [
      "تحبي تقوليلي كام سنة عُمْرِك دلوقتي؟",
      "ممكن أعرف سنك دلوقتي بالأرقام؟",
      "نبدأ بسؤال بسيط... كام سنة عُمْرِك؟",
    ],
    husband: [
      "ممكن أعرف عمر الزوجة بالأرقام؟",
      "حضرتك مراتك سنها كام دلوقتي؟",
      "نبدأ بسؤال بسيط... كام سنة سن الزوجة؟",
    ],
    unknown: [
      "نبدأ بسؤال بسيط... كام سنة سن الزوجة دلوقتي؟",
      "ممكن نبدأ بسن الزوجة بالأرقام لو سمحت؟",
    ],
  },
  duration: {
    wife: [
      "وبقالك قد إيه بتحاولي تِحْمَلي؟ بالسنين لو سمحتي.",
      "من إمتى الموضوع بدأ معاكم؟ بالسنين تقريباً.",
    ],
    husband: [
      "وبقالكم قد إيه بتحاولوا؟ بالسنين لو سمحت.",
      "من إمتى الموضوع بدأ معاكم؟ بالسنين تقريباً.",
    ],
    unknown: [
      "بقالكم قد إيه في الموضوع؟ بالسنين لو سمحت.",
      "من إمتى الرحلة بدأت؟ بالسنين تقريباً.",
    ],
  },
  cycle: {
    wife: [
      "الدَّوْرَة عندك بتيجي مظبوطة كل شهر؟",
      "نتكلم شوية عن الدَّوْرَة... منتظمة كل شهر؟",
    ],
    husband: [
      "الدَّوْرَة عند مراتك مظبوطة كل شهر؟",
      "نتكلم شوية عن الدَّوْرَة عند مراتك... منتظمة كل شهر؟",
    ],
    unknown: [
      "الدَّوْرَة منتظمة كل شهر؟",
      "ممكن نعرف الدَّوْرَة بتيجي مظبوطة كل شهر ولا لأ؟",
    ],
  },
  hormonal: {
    wife: [
      "في عندك أي مشاكل هُرْمُونِيَّة أو تَكَيُسْ معروف؟",
      "نتكلم عن الهُرْمُونَات شوية... فيه أي مشكلة معروفة أو تَكَيُسْ؟",
    ],
    husband: [
      "في عند مراتك أي مشاكل هُرْمُونِيَّة أو تَكَيُسْ معروف؟",
      "نتكلم عن الهُرْمُونَات بتاعة مراتك... فيه أي مشكلة معروفة أو تَكَيُسْ؟",
    ],
    unknown: [
      "في أي مشاكل هُرْمُونِيَّة أو تَكَيُسْ معروفة عند الزوجة؟",
    ],
  },
  amh: {
    wife: [
      "عملتي تَحْلِيل مَخْزُون المِبْيَض قبل كده؟ لو فاكرة الرقم قوليه... ولو لأ قولي مش عارفة.",
      "في تَحْلِيل مَخْزُون مِبْيَض اتعمل قبل كده؟ لو الرقم متعرف اتفضلي قوليه.",
    ],
    husband: [
      "عملت مراتك تَحْلِيل مَخْزُون المِبْيَض قبل كده؟ لو فاكر الرقم قوله... ولو لأ قول مش متأكد.",
      "في تَحْلِيل مَخْزُون مِبْيَض اتعمل لمراتك؟ لو الرقم متعرف اتفضل قوله.",
    ],
    unknown: [
      "في تَحْلِيل مَخْزُون مِبْيَض اتعمل قبل كده؟ لو الرقم معروف اتفضل قوله.",
    ],
  },
  previous_ivf: {
    wife: [
      "حصل محاولات حَقْن مِجْهَرِي قبل كده؟ لو آه... كام مرة؟",
      "في محاولات سابقة لِلحَقْن المِجْهَرِي؟ كام مرة؟",
    ],
    husband: [
      "حصل محاولات حَقْن مِجْهَرِي قبل كده؟ لو آه... كام مرة؟",
      "في محاولات سابقة لِلحَقْن المِجْهَرِي لمراتك؟ كام مرة؟",
    ],
    unknown: [
      "كام محاولة حَقْن مِجْهَرِي قبل كده؟",
    ],
  },
  previous_pregnancy: {
    wife: [
      "حصل حَمْل قبل كده؟ حتى لو ما اكتملش.",
      "في حَمْل قبل كده؟ حتى لو ما كملش.",
    ],
    husband: [
      "حصل حَمْل قبل كده عند مراتك؟ حتى لو ما اكتملش.",
      "في حَمْل قبل كده عند مراتك؟ حتى لو ما كملش.",
    ],
    unknown: [
      "في حَمْل قبل كده؟ حتى لو ما اكتملش.",
    ],
  },
  male_factor: {
    wife: [
      "عند الزوج عامل ذكري معروف؟ يعني تَحْلِيل سَائِل مَنَوِي فيه مشكلة؟",
      "تَحْلِيل السَّائِل المَنَوِي بتاع الزوج فيه أي ملاحظة معروفة؟",
    ],
    husband: [
      "تَحْلِيل السَّائِل المَنَوِي بتاع حضرتك فيه أي مشكلة معروفة؟",
      "هل عملت تَحْلِيل سَائِل مَنَوِي قبل كده؟ كان فيه أي ملاحظة؟",
    ],
    unknown: [
      "هل في عامل ذكري معروف عند الزوج؟ يعني تَحْلِيل سَائِل مَنَوِي فيه مشكلة؟",
    ],
  },
  files: {
    wife: [
      "قبل ما نكمّل... لو عندك تَحَالِيل أو أشعة أو تقارير قديمة... ارفعيها دلوقتي. ولما تخلصي قولي خلصت أو كده تمام.",
    ],
    husband: [
      "قبل ما نكمّل... لو معاكم أي تَحَالِيل أو أشعة أو تقارير قديمة... ارفعها دلوقتي. ولما تخلص قول خلصت أو كده تمام.",
    ],
    unknown: [
      "قبل ما نكمّل... لو في أي تَحَالِيل أو أشعة أو تقارير قديمة عندكم... ارفعوها دلوقتي. ولما تخلصوا قولوا خلصت أو كده تمام.",
    ],
  },
  consent: {
    wife: ["تحبي نبعت التقرير للمركز عشان حد يتواصل معاكي؟"],
    husband: ["تحب نبعت التقرير للمركز عشان حد يتواصل معاكم؟"],
    unknown: ["تحبوا نبعت التقرير للمركز عشان حد يتواصل معاكم؟"],
  },
};

/** Reprompts (clarification asks) — kept short and role-aware. */
const REPROMPTS: Partial<Record<StepId, Record<SpeakerRole, string>>> = {
  age: {
    wife: "معلش... قوليلي عُمْرِك بالأرقام؟ زي اتنين وتلاتين.",
    husband: "معلش... قول سن مراتك بالأرقام؟ زي اتنين وتلاتين.",
    unknown: "معلش... قول سن الزوجة بالأرقام؟ زي اتنين وتلاتين.",
  },
  duration: {
    wife: "قوليلي بس... المدة قد إيه بالسنين؟ سنتين، تلاتة، زي كده.",
    husband: "قولي بس... المدة قد إيه بالسنين؟ سنتين، تلاتة، زي كده.",
    unknown: "ممكن المدة بالسنين بس؟ سنتين، تلاتة، زي كده.",
  },
  cycle: {
    wife: "معلش... الدَّوْرَة بتيجي مظبوطة كل شهر ولا لأ؟ أيوه ولا لأ.",
    husband: "معلش... الدَّوْرَة عند مراتك بتيجي مظبوطة كل شهر ولا لأ؟ أيوه ولا لأ.",
    unknown: "معلش... الدَّوْرَة منتظمة كل شهر ولا لأ؟ أيوه ولا لأ.",
  },
  hormonal: {
    wife: "يعني فيه هُرْمُونَات أو تَكَيُسْ مبايض عندك؟ أيوه ولا لأ.",
    husband: "يعني فيه هُرْمُونَات أو تَكَيُسْ مبايض عند مراتك؟ أيوه ولا لأ.",
    unknown: "يعني فيه هُرْمُونَات أو تَكَيُسْ مبايض معروف؟ أيوه ولا لأ.",
  },
  amh: {
    wife: "قوليلي رقم تَحْلِيل مَخْزُون المِبْيَض... زي اتنين فاصلة خمسة... ولو مش فاكرة قولي مش عارفة.",
    husband: "قولي رقم تَحْلِيل مَخْزُون المِبْيَض لمراتك... زي اتنين فاصلة خمسة... ولو مش متأكد قول مش عارف.",
    unknown: "قولي رقم تَحْلِيل مَخْزُون المِبْيَض... زي اتنين فاصلة خمسة... ولو مش متأكد قول مش عارف.",
  },
  previous_ivf: {
    wife: "قوليلي عدد المحاولات بالأرقام؟ أو لأ لو ما عملتيش.",
    husband: "قول عدد المحاولات بالأرقام؟ أو لأ لو ما حصلش قبل كده.",
    unknown: "قول عدد المحاولات بالأرقام؟ أو لأ لو ما حصلش قبل كده.",
  },
  previous_pregnancy: {
    wife: "حصل حَمْل قبل كده ولا لأ؟ أيوه ولا لأ.",
    husband: "حصل حَمْل قبل كده عند مراتك ولا لأ؟ أيوه ولا لأ.",
    unknown: "حصل حَمْل قبل كده ولا لأ؟ أيوه ولا لأ.",
  },
  male_factor: {
    wife: "يعني تَحْلِيل السَّائِل المَنَوِي فيه مشكلة؟ أيوه ولا لأ؟ ولو مش متأكدة قولي مش عارفة.",
    husband: "يعني تَحْلِيل السَّائِل المَنَوِي بتاعك فيه مشكلة؟ أيوه ولا لأ؟ ولو مش متأكد قول مش عارف.",
    unknown: "يعني تَحْلِيل السَّائِل المَنَوِي عند الزوج فيه مشكلة؟ أيوه ولا لأ؟ ولو مش متأكد قول مش عارف.",
  },
};

function pickQuestion(step: StepId, role: SpeakerRole): string {
  const bank =
    QUESTIONS[step]?.[role] ??
    QUESTIONS[step]?.unknown ??
    [];
  if (bank.length === 0) return "";
  return randomOf(bank);
}

function pickReprompt(step: StepId, role: SpeakerRole): string {
  return (
    REPROMPTS[step]?.[role] ??
    REPROMPTS[step]?.unknown ??
    "ممكن نعيد السؤال؟"
  );
}

/** Compose "{ack}{... reaction}{... question}" while keeping spacing tidy. */
function compose(parts: (string | undefined | null)[]): string {
  return parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join("... ");
}

function roleAware(role: SpeakerRole, opts: {
  feminine: string;
  masculine: string;
  neutral: string;
}): string {
  if (role === "wife") return opts.feminine;
  if (role === "husband") return opts.masculine;
  return opts.neutral;
}

// ───────────────────── closing summary speech ─────────────────────

function buildSummarySpeech(answers: Answers): string {
  const r = predict(answers);
  const role = answers.speakerRole ?? "unknown";

  const closing = roleAware(role, {
    feminine: "تحبي نبعت التقرير للمركز... عشان حد يتواصل معاكي؟",
    masculine: "تحب نبعت التقرير للمركز... عشان حد يتواصل معاكم؟",
    neutral: "تحبوا نبعت التقرير للمركز... عشان حد يتواصل معاكم؟",
  });

  if (!r.dataSufficient) {
    return (
      "البيانات اللي معانا دلوقتي مش كافية لتقييم تفصيلي... " +
      "بس فيه خطوات عملية واضحة هتساعدنا نوضح المسار العلاجي. " +
      "هنحتاج نكمّل التَّحَالِيل الأساسية... زي تَحْلِيل مَخْزُون المِبْيَض... " +
      "وتَحْلِيل هُرْمُونَات شامل... وتَحْلِيل سَائِل مَنَوِي... وسونار حديث. " +
      closing
    );
  }

  const lead =
    r.confidence === "medium"
      ? "بناءً على كلامكم والملفات المرفوعة"
      : "بناءً على كلامكم والملفات اللي وصلتنا";

  return (
    `${lead}... تشير البيانات الأولية إلى مؤشرات يمكن البناء عليها... ` +
    `وهتساعدنا نوجّه الخطوات القادمة بشكل أدق مع الفريق الطبي. ` +
    `ده تقرير مبدئي داعم للقرار... وما بياخدش أي قرار طبي. ` +
    closing
  );
}

// ────────────────────────── main handler ──────────────────────────

export function handleAnswer(
  step: StepId,
  userText: string,
  prev: Answers
): StepResult {
  // Run role inference on every turn until a confident cue is found.
  const role = updateRole(prev.speakerRole, userText);
  const answers: Answers = { ...prev, speakerRole: role };

  switch (step) {
    case "intro": {
      // Open intake step. We don't try to extract specific values from
      // the free-form intro — we just acknowledge contextually and
      // proceed with the age question in role-aware phrasing.
      const opener = roleAware(role, {
        feminine: "أهلاً بيكي",
        masculine: "أهلاً بحضرتك",
        neutral: "أهلاً بيكم",
      });
      return {
        assistant: compose([opener, "فهمت معاكم", pickQuestion("age", role)]),
        next: "age",
        answers,
        autoListen: true,
      };
    }

    case "age": {
      const n = extractNumber(userText);
      if (n === null || n < 15 || n > 60) {
        return {
          assistant: pickReprompt("age", role),
          next: "age",
          answers,
          autoListen: true,
        };
      }
      answers.age = Math.round(n);
      let reaction = "";
      if (answers.age < 30) reaction = "السن في نطاق كويس جداً.";
      else if (answers.age < 35) reaction = "السن في نطاق جيد.";
      else if (answers.age < 40) reaction = "تمام، مفهوم.";
      else reaction = "تمام، هناخد بالنا من عامل السن.";
      return {
        assistant: compose([ack(), reaction, pickQuestion("duration", role)]),
        next: "duration",
        answers,
        autoListen: true,
      };
    }

    case "duration": {
      let years: number | null = extractNumber(userText);
      if (years !== null && containsAny(userText, ["شهر", "شهور", "month"])) {
        years = years / 12;
      }
      if (years === null || years < 0 || years > 25) {
        return {
          assistant: pickReprompt("duration", role),
          next: "duration",
          answers,
          autoListen: true,
        };
      }
      answers.duration_years = Math.round(years * 10) / 10;
      return {
        assistant: compose([ack(), "خلينا نكمل", pickQuestion("cycle", role)]),
        next: "cycle",
        answers,
        autoListen: true,
      };
    }

    case "cycle": {
      const c = classifyYesNo(userText);
      if (c === "unclear") {
        return {
          assistant: pickReprompt("cycle", role),
          next: "cycle",
          answers,
          autoListen: true,
        };
      }
      answers.cycle_regular = c === "yes";
      const followup = answers.cycle_regular
        ? "تمام... ده مؤشر حلو."
        : "ماشي... خدنا بالنا من النقطة دي.";
      return {
        assistant: compose([followup, pickQuestion("hormonal", role)]),
        next: "hormonal",
        answers,
        autoListen: true,
      };
    }

    case "hormonal": {
      const mentionsPCOS = containsAny(userText, [
        "تكيس",
        "pcos",
        "تكيسات",
        "poly",
      ]);
      const c = classifyYesNo(userText);
      if (c === "unclear" && !mentionsPCOS && !isUnknown(userText)) {
        return {
          assistant: pickReprompt("hormonal", role),
          next: "hormonal",
          answers,
          autoListen: true,
        };
      }
      if (mentionsPCOS) {
        answers.pcos = true;
        answers.hormonal_issues = true;
      } else if (c === "yes") {
        answers.hormonal_issues = true;
      } else if (c === "no") {
        answers.hormonal_issues = false;
        answers.pcos = false;
      }
      return {
        assistant: compose([ack(), pickQuestion("amh", role)]),
        next: "amh",
        answers,
        autoListen: true,
      };
    }

    case "amh": {
      if (
        isUnknown(userText) ||
        containsAny(userText, ["ما عملتش", "معملتش", "لسه"])
      ) {
        answers.amh = "unknown";
        return {
          assistant: compose([
            ack(),
            "هنحط تَحْلِيل مَخْزُون المِبْيَض في التَّحَالِيل المقترحة",
            pickQuestion("previous_ivf", role),
          ]),
          next: "previous_ivf",
          answers,
          autoListen: true,
        };
      }
      const n = extractNumber(userText);
      if (n === null || n < 0 || n > 15) {
        return {
          assistant: pickReprompt("amh", role),
          next: "amh",
          answers,
          autoListen: true,
        };
      }
      answers.amh = Math.round(n * 10) / 10;
      let reaction = "";
      if (n < 1) reaction = "المَخْزُون واطي شوية... بس ده مش نهاية الطريق.";
      else if (n <= 4) reaction = "المَخْزُون في النطاق الطبيعي... ده كويس.";
      else reaction = "القيمة عالية شوية... يمكن تبقى مؤشر لتَكَيُسْ.";
      return {
        assistant: compose([reaction, pickQuestion("previous_ivf", role)]),
        next: "previous_ivf",
        answers,
        autoListen: true,
      };
    }

    case "previous_ivf": {
      const c = classifyYesNo(userText);
      const n = extractNumber(userText);
      if (c === "no" && (n === null || n === 0)) {
        answers.previous_ivf_count = 0;
        return {
          assistant: compose([
            ack(),
            "يعني أول محاولة بإذن الله",
            pickQuestion("previous_pregnancy", role),
          ]),
          next: "previous_pregnancy",
          answers,
          autoListen: true,
        };
      }
      if (n !== null && n >= 0 && n <= 10) {
        answers.previous_ivf_count = Math.round(n);
      } else if (c === "yes") {
        answers.previous_ivf_count = 1;
      } else {
        return {
          assistant: pickReprompt("previous_ivf", role),
          next: "previous_ivf",
          answers,
          autoListen: true,
        };
      }
      const count = answers.previous_ivf_count!;
      const reaction =
        count === 0
          ? "تمام... أول محاولة."
          : count === 1
          ? "ماشي... محاولة واحدة قبل كده."
          : `تمام... ${count} محاولات قبل كده.`;
      return {
        assistant: compose([reaction, pickQuestion("previous_pregnancy", role)]),
        next: "previous_pregnancy",
        answers,
        autoListen: true,
      };
    }

    case "previous_pregnancy": {
      const c = classifyYesNo(userText);
      if (c === "unclear") {
        return {
          assistant: pickReprompt("previous_pregnancy", role),
          next: "previous_pregnancy",
          answers,
          autoListen: true,
        };
      }
      answers.previous_pregnancy = c === "yes";
      const reaction = answers.previous_pregnancy
        ? "كويس... ده مؤشر حلو."
        : "ماشي... مفهوم.";
      return {
        assistant: compose([
          reaction,
          "آخر سؤال هنا",
          pickQuestion("male_factor", role),
        ]),
        next: "male_factor",
        answers,
        autoListen: true,
      };
    }

    case "male_factor": {
      const c = classifyYesNo(userText);
      if (c === "unknown") {
        answers.male_factor = undefined;
      } else if (c === "unclear") {
        return {
          assistant: pickReprompt("male_factor", role),
          next: "male_factor",
          answers,
          autoListen: true,
        };
      } else {
        answers.male_factor = c === "yes";
      }

      const thanks = roleAware(role, {
        feminine: "تمام... شكراً ليكي",
        masculine: "تمام... شكراً لحضرتك",
        neutral: "تمام... شكراً ليكم",
      });

      return {
        assistant: compose([thanks, pickQuestion("files", role)]),
        next: "files",
        answers,
        autoListen: true,
      };
    }

    case "files": {
      // User signaling they're done uploading?
      if (isDoneUploading(userText)) {
        const speech = buildSummarySpeech(answers);
        const filesNote = (answers.uploaded_files ?? []).length
          ? "تمام... استلمت الملفات... خلينا نكمّل التَّحْلِيل... "
          : "تمام... هنكمّل من غير ملفات... ";
        return {
          assistant: filesNote + speech,
          next: "consent",
          answers,
          autoListen: true,
        };
      }

      // User says they don't have files
      if (
        classifyYesNo(userText) === "no" &&
        !wantsToUpload(userText)
      ) {
        const speech = buildSummarySpeech(answers);
        return {
          assistant:
            "ماشي... هنكمّل من غير ملفات... والتَّحَالِيل المقترحة هتبان في التقرير... " +
            speech,
          next: "consent",
          answers,
          autoListen: true,
        };
      }

      // User mentioned they will upload, or said anything else → keep waiting.
      const fileCount = (answers.uploaded_files ?? []).length;
      const reminder = fileCount
        ? `استلمت ${fileCount} ملف لحد دلوقتي... لو في ملفات تانية اتفضلوا ارفعوها... ولو خَلَصْتُوا قولوا خَلَصْت.`
        : "تقدروا ترفعوا من الزرار تحت... ولو مفيش حاجة عندكم قولوا مفيش... ونكمّل.";
      return {
        assistant: reminder,
        next: "files",
        answers,
        autoListen: true,
      };
    }

    case "summary":
    case "consent": {
      const c = classifyYesNo(userText);
      if (c === "yes") {
        const closing = roleAware(role, {
          feminine: "تمام... البيانات اتسجلت... وهيتواصلوا معاكي قريب... ربنا يقدّر اللي فيه الخير.",
          masculine: "تمام... البيانات اتسجلت... وهيتواصلوا معاكم قريب... ربنا يِقَدّر اللي فيه الخير.",
          neutral: "تمام... البيانات اتسجلت... وهيتواصلوا معاكم قريب... ربنا يِقدّر اللي فيه الخير.",
        });
        return {
          assistant: closing,
          next: "done",
          answers,
          done: true,
          autoListen: false,
        };
      }
      if (c === "no") {
        const closing = roleAware(role, {
          feminine: "ماشي... التقرير قدامك... تقدري تراجعيه أو تحمّليه... وتِقْدَري ترجعي أي وقت.",
          masculine: "ماشي... التقرير قدامك... تقدر تراجعه أو تحمّله... وتِقْدَر ترجع أي وقت.",
          neutral: "ماشي... التقرير قدامكم... تقدروا تراجعوه أو تحمّلوه... وتِقْدَروا ترجعوا أي وقت.",
        });
        return {
          assistant: closing,
          next: "done",
          answers,
          done: true,
          autoListen: false,
        };
      }
      return {
        assistant: pickQuestion("consent", role) + " قولي أيوه أو لأ.",
        next: "consent",
        answers,
        autoListen: true,
      };
    }

    case "done":
    default:
      return {
        assistant: roleAware(role, {
          feminine: "شكراً ليكي... والله ييسّر.",
          masculine: "شكراً لحضرتك... والله ييسّر.",
          neutral: "شكراً ليكم... والله ييسّر.",
        }),
        next: "done",
        answers,
        done: true,
      };
  }
}

/** Spoken acknowledgement for each new file uploaded during the files step. */
export function uploadAck(totalFiles: number): string {
  const variants = [
    `تمام... استلمت الملف... لو في حاجة تانية ارفعوها... أنا معاكم... ولو خَلَصْتُوا قولوا خَلَصْت.`,
    `حلو... الملف وصل... تقدروا ترفعوا تاني... أو قولوا كده تمام لما نكمّل.`,
    `تمام... الملف عندي... لو في تقارير تانية ارفعوها... ولما تِخَلَصُوا قولوا خَلَصْت.`,
  ] as const;
  const base = randomOf(variants);
  if (totalFiles >= 3) {
    return `${base}... استلمت ${totalFiles} ملفات لحد دلوقتي.`;
  }
  return base;
}
