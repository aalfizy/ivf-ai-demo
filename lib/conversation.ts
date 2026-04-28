import type { Answers, StepId } from "./types";
import {
  classifyYesNo,
  containsAny,
  extractNumber,
  isDoneUploading,
  isUnknown,
  normalize,
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

const ACK = ["تمام", "طيب", "حلو", "أوكي", "ماشي", "تمام كده"];
const randomOf = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
const ack = () => randomOf(ACK);

/** First utterance — welcoming, warm Egyptian tone. */
export function intro(): { text: string; next: StepId } {
  return {
    text:
      "أهلاً بيكي، أنا المساعد الذكي للمركز. هسألك كام سؤال بسيط، وخلينا نمشي خطوة خطوة مع بعض. تقدري تجاوبي بصوتك بالراحة. يلا نبدأ… كام سنة عمرك؟",
    next: "age",
  };
}

/**
 * Build the closing summary speech (used when the user finishes uploading
 * and we move from "files" → "summary" → "consent").
 */
function buildSummarySpeech(answers: Answers): string {
  const r = predict(answers);
  const categoryPhrase =
    r.category === "مرتفعة"
      ? "نسبة نجاح مرتفعة"
      : r.category === "جيدة"
      ? "نسبة نجاح جيدة"
      : r.category === "متوسطة"
      ? "نسبة نجاح متوسطة"
      : "نسبة نجاح منخفضة نسبياً";

  const confPhrase =
    r.confidence === "high"
      ? "ودرجة الثقة في التقييم عالية لأن البيانات والملفات موجودة"
      : r.confidence === "medium"
      ? "ودرجة الثقة متوسطة، فيه شوية تحاليل لو ضفناها هترفع الدقة"
      : "ودرجة الثقة مبدئية، لإننا لسه ما عندناش تحاليل مرفوعة";

  const lead =
    r.confidence === "low"
      ? "بناءً على كلامك من غير تحاليل مرفوعة"
      : "بناءً على كلامك والملفات المرفوعة";

  return (
    `${lead}، نقدر نقول إن الحالة احتمالية نجاحها ${categoryPhrase} ` +
    `ما بين ${r.low} بالمية و ${r.high} بالمية. ${confPhrase}. ` +
    `وده تقييم مبدئي فقط ولا يغني عن زيارة الطبيب المختص. ` +
    `تحبي نبعت التقرير للمركز عشان حد يتواصل معاكي؟`
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
            "معلش، ممكن تقوليلي عمرك بالأرقام؟ مثلاً اتنين وتلاتين.",
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
        assistant: `${ack()}… ${reaction} وبقالك قد إيه بتحاولي تحملي؟ بالسنين لو سمحتي.`,
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
            "ممكن تقوليلي المدة بالسنين؟ مثلاً سنتين، أو تلات سنين.",
          next: "duration",
          answers,
          autoListen: true,
        };
      }
      answers.duration_years = Math.round(years * 10) / 10;
      return {
        assistant: `${ack()}، خلينا نكمل. هل في انتظام في الدورة الشهرية؟`,
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
            "معلش، الدورة بتيجي منتظمة كل شهر ولا لأ؟ جاوبي بـ نعم أو لا.",
          next: "cycle",
          answers,
          autoListen: true,
        };
      }
      answers.cycle_regular = c === "yes";
      const followup = answers.cycle_regular
        ? "تمام، ده مؤشر كويس."
        : "ماشي، خدنا بالنا من النقطة دي.";
      return {
        assistant: `${followup} هل عندك أي مشاكل هرمونية أو تكيس في المبايض؟`,
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
            "يعني في مشاكل هرمونية أو تكيس مبايض؟ جاوبي بـ نعم أو لا.",
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
        assistant: `${ack()}… هل عملتي تحليل AMH قبل كده؟ لو فاكرة الرقم قوليه، ولو لأ قولي "مش عارفة".`,
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
          assistant: `${ack()}، هنضيفه في التحاليل المقترحة. وبقالك محاولات حقن مجهري قبل كده؟ لو آه كام مرة؟`,
          next: "previous_ivf",
          answers,
          autoListen: true,
        };
      }
      const n = extractNumber(userText);
      if (n === null || n < 0 || n > 15) {
        return {
          assistant:
            "ممكن تقوليلي قيمة الـ AMH؟ مثلاً اتنين فاصلة خمسة. ولو مش فاكرة قولي مش عارفة.",
          next: "amh",
          answers,
          autoListen: true,
        };
      }
      answers.amh = Math.round(n * 10) / 10;
      let reaction = "";
      if (n < 1) reaction = "المخزون منخفض شوية، بس ده مش نهاية الطريق.";
      else if (n <= 4) reaction = "المخزون في النطاق الطبيعي، ده كويس.";
      else reaction = "القيمة مرتفعة شوية، ممكن تكون مؤشر لتكيس.";
      return {
        assistant: `${reaction} وبقالك محاولات حقن مجهري قبل كده؟ لو آه كام مرة؟`,
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
          assistant: `${ack()}، يعني أول محاولة بإذن الله. وهل حصل حمل قبل كده، حتى لو ما كملش؟`,
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
            "ممكن تقوليلي عدد المحاولات السابقة بالأرقام؟ أو قولي لأ لو ما عملتيش.",
          next: "previous_ivf",
          answers,
          autoListen: true,
        };
      }
      const count = answers.previous_ivf_count!;
      const reaction =
        count === 0
          ? "تمام، أول محاولة."
          : count === 1
          ? "ماشي، محاولة واحدة سابقة."
          : `تمام، ${count} محاولات سابقة.`;
      return {
        assistant: `${reaction} وهل حصل حمل قبل كده، حتى لو ما كملش؟`,
        next: "previous_pregnancy",
        answers,
        autoListen: true,
      };
    }

    case "previous_pregnancy": {
      const c = classifyYesNo(userText);
      if (c === "unclear") {
        return {
          assistant: "حصل حمل قبل كده ولا لأ؟",
          next: "previous_pregnancy",
          answers,
          autoListen: true,
        };
      }
      answers.previous_pregnancy = c === "yes";
      const reaction = answers.previous_pregnancy
        ? "كويس جداً، ده مؤشر إيجابي."
        : "ماشي، مفهوم.";
      return {
        assistant: `${reaction} وآخر سؤال في الجزء ده: هل في عامل ذكري معروف عند الزوج؟ يعني تحليل سائل منوي بيقول في مشكلة؟`,
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
            "يعني في تحليل سائل منوي بيقول في مشكلة؟ نعم ولا لأ، ولو مش متأكدة قولي مش عارفة.",
          next: "male_factor",
          answers,
          autoListen: true,
        };
      } else {
        answers.male_factor = c === "yes";
      }

      // Transition into the upload step (NEVER jump straight to results).
      return {
        assistant:
          "تمام، شكراً ليكي. قبل ما نكمل، لو عندك أي تحاليل أو أشعة أو تقارير سابقة، تقدري ترفعيها دلوقتي عشان تساعدني أدي تقييم أدق. لو تحبي ترفعي أي فايل دلوقتي أنا معاكي. ولما تخلصي قوليلي 'خلصت' أو 'كده تمام'.",
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
          ? "تمام كده، استلمت كل الملفات، خلينا نكمل التحليل. "
          : "تمام، هنكمل من غير ملفات. ";
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
            "ماشي، هنكمل من غير ملفات وهنوضح لك التحاليل المقترحة في التقرير. " +
            speech,
          next: "consent",
          answers,
          autoListen: true,
        };
      }

      // User mentioned they will upload, or said anything else → keep waiting.
      const reminder = (answers.uploaded_files ?? []).length
        ? `استلمت ${(answers.uploaded_files ?? []).length} ملف لحد دلوقتي. لو هترفعي تاني اتفضلي، ولو خلصتي قوليلي "خلصت".`
        : "تقدري ترفعي الملفات من الزرار اللي تحت. ولو مفيش عندك حاجة، قولي 'مفيش' وهنكمل.";
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
            "تم إرسال البيانات، وهيتم التواصل معاكي قريباً. ربنا يقدرلك اللي فيه الخير.",
          next: "done",
          answers,
          done: true,
          autoListen: false,
        };
      }
      if (c === "no") {
        return {
          assistant:
            "ماشي، التقرير قدامك تقدري تراجعيه أو تحمليه. وتقدري ترجعي في أي وقت.",
          next: "done",
          answers,
          done: true,
          autoListen: false,
        };
      }
      return {
        assistant: "تحبي نبعت التقرير للمركز؟ جاوبي بـ نعم أو لا.",
        next: "consent",
        answers,
        autoListen: true,
      };
    }

    case "done":
    default:
      return {
        assistant: "شكراً ليكي.",
        next: "done",
        answers,
        done: true,
      };
  }
}

/** Spoken acknowledgement for each new file uploaded during the files step. */
export function uploadAck(totalFiles: number): string {
  const lines = [
    `تمام استلمت الملف. لو في حاجة تانية ترفعيها، أنا معاكي. ولو خلصتي قوليلي "خلصت".`,
    `حلو، استلمت الملف. تقدري ترفعي تاني، أو قولي "كده تمام" لما نكمل.`,
    `تمام، الملف وصلني. لو فيه تقارير تانية ارفعيها، ولما تخلصي قولي "خلصت".`,
  ];
  const base = randomOf(lines);
  if (totalFiles >= 3) {
    return `${base} استلمت ${totalFiles} ملفات لحد دلوقتي.`;
  }
  return base;
}
