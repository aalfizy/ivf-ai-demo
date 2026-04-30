import type { Answers, StepId } from "./types";
import {
  classifyYesNo,
  containsAny,
  extractNumber,
  isDoneUploading,
  isUnknown,
  wantsToUpload,
} from "./parsing";
import { predict } from "./prediction";

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

/** First utterance — warm spoken Egyptian; ellipses → SSML pauses in TTS. */
export function intro(): { text: string; next: StepId } {
  return {
    text:
      "أهلاً بيكي... أنا مساعدة المركز... هسألك كام سؤال بسيط... ونمشي خطوة خطوة مع بعض. جاوبي بالراحة بصوتك... يلا نبدأ... كام سنة عُمْرِك؟",
    next: "age",
  };
}

/**
 * Build the closing summary speech (used when the user finishes uploading
 * and we move from "files" → "summary" → "consent").
 */
function buildSummarySpeech(answers: Answers): string {
  const r = predict(answers);
  // Short adjective phrases — the lead-in noun "نسبة نجاح الحالة" is
  // composed once in the speech template below to avoid awkward repetition.
  const categoryPhrase =
    r.category === "مرتفعة"
      ? "مرتفعة"
      : r.category === "جيدة"
      ? "كويسة"
      : r.category === "متوسطة"
      ? "متوسطة"
      : "منخفضة نسبياً";

  const confPhrase =
    r.confidence === "high"
      ? "ودرجة الثقة عالية... عشان البيانات والملفات موجودة"
      : r.confidence === "medium"
      ? "ودرجة الثقة متوسطة... فيه تحاليل لو ضفناها الدقة تتظبط أكتر"
      : "ودرجة الثقة لسه مبدئية... لإن مفيش تحاليل مرفوعة";

  const lead =
    r.confidence === "low"
      ? "بناءً على كلامك من غير تحاليل مرفوعة"
      : "بناءً على كلامك والملفات المرفوعة";

  return (
    `${lead}... نقدر نقول إن نسبة نجاح الحالة ${categoryPhrase}. ` +
    `ما بين ${r.low} و ${r.high} بالمية... ` +
    `${confPhrase}. ` +
    `ده تقييم مبدئي بس... وما يغنيش عن الدكتور المختص. ` +
    `تحبي نبعت التقرير للمركز... عشان حد يتواصل معاكي؟`
  );
}

export function handleAnswer(
  step: StepId,
  userText: string,
  prev: Answers
): StepResult {
  const answers: Answers = { ...prev };

  switch (step) {
    case "intro":
    case "age": {
      const n = extractNumber(userText);
      if (n === null || n < 15 || n > 60) {
        return {
          assistant:
            "معلش... قوليلي عُمْرِك بالأرقام؟... زي اتنين وتلاتين.",
          next: "age",
          answers,
          autoListen: true,
        };
      }
      answers.age = Math.round(n);
      let reaction = "";
      if (answers.age < 30) reaction = "السن كويس جداً.";
      else if (answers.age < 35) reaction = "السن في نطاق جيد.";
      else if (answers.age < 40) reaction = "تمام، مفهوم.";
      else reaction = "تمام، هناخد بالنا من عامل السن.";
      return {
        assistant: `${ack()}... ${reaction} وبقالك قد إيه بتحاولي تِحْمَلي؟... بالسنين لو سمحتي.`,
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
          assistant:
            "قوليلي بس... المدة قد إيه بالسنين؟... سنتين، تلاتة، زي كده.",
          next: "duration",
          answers,
          autoListen: true,
        };
      }
      answers.duration_years = Math.round(years * 10) / 10;
      return {
        assistant: `${ack()}... خلينا نكمل. الدورة مظبوطة كل شهر؟`,
        next: "cycle",
        answers,
        autoListen: true,
      };
    }

    case "cycle": {
      const c = classifyYesNo(userText);
      if (c === "unclear") {
        return {
          assistant:
            "معلش... الدورة بتيجي مظبوطة كل شهر ولا لأ؟... أيوه ولا لأ.",
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
        assistant: `${followup}... في أي مشاكل هرمونية أو تَكَيُسْ؟`,
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
          assistant:
            "يعني في هرمونات أو تَكَيُسْ مبايض؟... أيوه ولا لأ.",
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
        assistant: `${ack()}... عملتي تحليل مخزون المبايض قبل كده؟... لو فاكرة الرقم قوليه... ولو لأ قولي مش عارفة.`,
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
          assistant: `${ack()}... هنحط تحليل مخزون المبايض في التحاليل المقترحة... ومحاولات حَقْن مجهري قبل كده؟... لو آه... كام مرة؟`,
          next: "previous_ivf",
          answers,
          autoListen: true,
        };
      }
      const n = extractNumber(userText);
      if (n === null || n < 0 || n > 15) {
        return {
          assistant:
            "قوليلي رقم تحليل مخزون المِبْيَض... زي اتنين فاصلة خمسة... ولو مش فاكرة قولي مش عارفة.",
          next: "amh",
          answers,
          autoListen: true,
        };
      }
      answers.amh = Math.round(n * 10) / 10;
      let reaction = "";
      if (n < 1) reaction = "المخزون واطي شوية... بس ده مش نهاية الطريق.";
      else if (n <= 4) reaction = "المخزون في النطاق الطبيعي... ده كويس.";
      else reaction = "القيمة عالية شوية... يمكن تبقى مؤشر لتَكَيُسْ.";
      return {
        assistant: `${reaction}... محاولات حَقْن مجهري قبل كده؟... لو آه... كام مرة؟`,
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
          assistant: `${ack()}... يعني أول محاولة بإذن الله... حصل حَمْل قبل كده؟... حتى لو ما كملش؟`,
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
          assistant:
            "قوليلي عدد المحاولات بالأرقام؟... أو لأ لو ما عملتيش.",
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
        assistant: `${reaction}... حصل حَمْل قبل كده؟... حتى لو ما كملش؟`,
        next: "previous_pregnancy",
        answers,
        autoListen: true,
      };
    }

    case "previous_pregnancy": {
      const c = classifyYesNo(userText);
      if (c === "unclear") {
        return {
          assistant: "حصل حَمْل قبل كده ولا لأ؟... أيوه ولا لأ.",
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
        assistant: `${reaction}... آخر سؤال هنا... عند الزوج عامل ذكري معروف؟... يعني تحليل سائل مَنَوي فيه مشكلة؟`,
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
          assistant:
            "يعني تحليل السائل المَنَوي فيه مشكلة؟... أيوه ولا لأ؟... ولو مش متأكدة قولي مش عارفة.",
          next: "male_factor",
          answers,
          autoListen: true,
        };
      } else {
        answers.male_factor = c === "yes";
      }

      return {
        assistant:
          "تمام... شكراً ليكي... قبل ما نكمل... لو عندك تحاليل أو أشعة أو تقارير قديمة... ارفعيها دلوقتي... ده يخليني أوضح في التقييم... ولما تخلصي قوليلي خلصت... أو كده تمام.",
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
          ? "تمام... استلمت الملفات... خلينا نكمّل التحليل... "
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
            "ماشي... هنكمّل من غير ملفات... والتحاليل المقترحة هتبان في التقرير... " +
            speech,
          next: "consent",
          answers,
          autoListen: true,
        };
      }

      // User mentioned they will upload, or said anything else → keep waiting.
      const reminder = (answers.uploaded_files ?? []).length
        ? `استلمت ${(answers.uploaded_files ?? []).length} ملف لحد دلوقتي... لو هترفعي كمان اتفضلي... ولو خلصتي قوليلي خلصت.`
        : "تقدري ترفعي من الزرار تحت... ولو مفيش حاجة عندك قولي مفيش... ونكمّل.";
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
        return {
          assistant:
            "تمام... البيانات اتسجلت... وهيتواصلوا معاكي قريب... ربنا يقدّر اللي فيه الخير.",
          next: "done",
          answers,
          done: true,
          autoListen: false,
        };
      }
      if (c === "no") {
        return {
          assistant:
            "ماشي... التقرير قدامك... تقدري تراجعيه أو تحمّليه... وتقدري ترجعي أي وقت.",
          next: "done",
          answers,
          done: true,
          autoListen: false,
        };
      }
      return {
        assistant: "تحبي نبعت التقرير للمركز؟... قوليلي أيوه أو لأ.",
        next: "consent",
        answers,
        autoListen: true,
      };
    }

    case "done":
    default:
      return {
        assistant: "شكراً ليكي... والله ييسّر.",
        next: "done",
        answers,
        done: true,
      };
  }
}

/** Spoken acknowledgement for each new file uploaded during the files step. */
export function uploadAck(totalFiles: number): string {
  const variants = [
    `تمام... استلمت الملف... لو في حاجة تانية ارفعيها... أنا معاكي... ولو خلصتي قوليلي خلصت.`,
    `حلو... الملف وصل... تقدري ترفعي تاني... أو قولي كده تمام لما نكمّل.`,
    `تمام... الملف عندي... لو في تقارير تانية ارفعيها... ولما تخلصي قولي خلصت.`,
  ] as const;
  const base = randomOf(variants);
  if (totalFiles >= 3) {
    return `${base}... استلمت ${totalFiles} ملفات لحد دلوقتي.`;
  }
  return base;
}
