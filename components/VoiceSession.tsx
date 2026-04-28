"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import VoiceOrb from "./VoiceOrb";
import TranscriptPanel from "./TranscriptPanel";
import FileUpload from "./FileUpload";
import ProgressSteps from "./ProgressSteps";
import { handleAnswer, intro, uploadAck } from "@/lib/conversation";
import { predict } from "@/lib/prediction";
import { analyzeFiles } from "@/lib/fileAnalysis";
import type { Answers, ChatMessage, StepId } from "@/lib/types";
import {
  isRecognitionSupported,
  isSynthesisSupported,
  startListening,
} from "@/lib/speech";
import { cancelSpeak, prefetchSpeech, speak } from "@/lib/tts-elevenlabs";
import { clearSession, saveSession } from "@/lib/session";

type OrbState = "idle" | "listening" | "thinking" | "speaking";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export default function VoiceSession() {
  const router = useRouter();

  const [started, setStarted] = useState(false);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [step, setStep] = useState<StepId>("intro");
  const [answers, setAnswers] = useState<Answers>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [interim, setInterim] = useState<string>("");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const stopListeningRef = useRef<null | (() => void)>(null);
  const stateRef = useRef({ step, answers, muted, orbState });
  stateRef.current = { step, answers, muted, orbState };

  // Pending speech queue (used so file-upload acks don't interrupt mid-question speech).
  const pendingAckRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSupported(isRecognitionSupported() && isSynthesisSupported());
    // Pre-warm the intro line so the first click feels instant.
    prefetchSpeech(intro().text);
  }, []);

  const pushMessage = useCallback((role: "assistant" | "user", text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: newId(), role, text, at: Date.now() },
    ]);
  }, []);

  const stopListening = useCallback(() => {
    stopListeningRef.current?.();
    stopListeningRef.current = null;
  }, []);

  const beginListening = useCallback(() => {
    setError(null);
    setInterim("");
    setOrbState("listening");

    let gotFinal = false;
    stopListeningRef.current = startListening({
      lang: "ar-EG",
      onInterim: (t) => setInterim(t),
      onFinal: (text) => {
        gotFinal = true;
        setInterim("");
        handleUserText(text);
      },
      onError: (err) => {
        if (err === "no-speech") {
          setOrbState("idle");
          setTimeout(() => {
            if (stateRef.current.step !== "done") beginListening();
          }, 300);
          return;
        }
        if (err === "not-allowed" || err === "service-not-allowed") {
          setError(
            "مش قادرين نوصل للميكروفون. من فضلك اسمحي للموقع باستخدام الميكروفون."
          );
        } else if (err !== "aborted") {
          setError("حصلت مشكلة في الاستماع. جربي تاني.");
        }
        setOrbState("idle");
      },
      onEnd: () => {
        if (!gotFinal && stateRef.current.step !== "done") {
          setOrbState((s) => (s === "listening" ? "idle" : s));
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speakAssistant = useCallback(
    async (text: string, autoListen: boolean) => {
      pushMessage("assistant", text);
      setOrbState("speaking");

      const finish = () => {
        // Flush any queued upload-ack first
        const queued = pendingAckRef.current;
        pendingAckRef.current = null;
        if (queued) {
          // Speak the ack, then auto-listen if needed
          setTimeout(() => speakAssistant(queued, autoListen), 250);
          return;
        }
        setOrbState("idle");
        if (autoListen) setTimeout(() => beginListening(), 400);
      };

      if (stateRef.current.muted) {
        setTimeout(finish, 600);
        return;
      }

      await speak(text, {
        lang: "ar-EG",
        rate: 1.0,
        onEnd: finish,
        onError: finish,
      });
    },
    [beginListening, pushMessage]
  );

  const handleUserText = useCallback(
    (text: string) => {
      pushMessage("user", text);
      setOrbState("thinking");
      stopListening();

      const currentStep = stateRef.current.step;
      const currentAnswers = stateRef.current.answers;

      setTimeout(() => {
        const res = handleAnswer(currentStep, text, currentAnswers);
        setAnswers(res.answers);
        setStep(res.next);

        if (res.next === "done") {
          const prediction = predict(res.answers);
          setMessages((prev) => {
            const finalTranscript = [
              ...prev,
              {
                id: newId(),
                role: "assistant" as const,
                text: res.assistant,
                at: Date.now(),
              },
            ];
            saveSession({
              answers: res.answers,
              prediction,
              transcript: finalTranscript,
              completedAt: Date.now(),
            });
            return prev;
          });
          speakAssistant(res.assistant, false).then(() => {
            setTimeout(() => router.push("/report"), 1200);
          });
          return;
        }

        speakAssistant(res.assistant, res.autoListen ?? true);
      }, 700 + Math.random() * 400);
    },
    [pushMessage, router, speakAssistant, stopListening]
  );

  const handleOrbClick = useCallback(() => {
    if (!supported) {
      setError(
        "المتصفح ده مش بيدعم الصوت. جربي Google Chrome أو Edge على كمبيوتر أو أندرويد."
      );
      return;
    }

    if (!started) {
      setStarted(true);
      clearSession();
      const { text, next } = intro();
      setStep(next);
      speakAssistant(text, true);
      return;
    }

    if (orbState === "listening") {
      stopListening();
      setOrbState("idle");
      return;
    }
    if (orbState === "speaking") {
      cancelSpeak();
      setOrbState("idle");
      beginListening();
      return;
    }
    if (orbState === "idle") {
      beginListening();
    }
  }, [
    beginListening,
    orbState,
    speakAssistant,
    started,
    stopListening,
    supported,
  ]);

  const handleReset = () => {
    cancelSpeak();
    stopListening();
    setStarted(false);
    setStep("intro");
    setAnswers({});
    setMessages([]);
    setInterim("");
    setError(null);
    setOrbState("idle");
    pendingAckRef.current = null;
    clearSession();
  };

  const handleSkipToReport = () => {
    const prediction = predict(answers);
    saveSession({
      answers,
      prediction,
      transcript: messages,
      completedAt: Date.now(),
    });
    router.push("/report");
  };

  const handleFilesChange = useCallback(
    (names: string[], added: string[]) => {
      setAnswers((a) => ({ ...a, uploaded_files: names }));

      // Acknowledge new uploads only during the dedicated files step
      if (added.length === 0) return;
      if (stateRef.current.step !== "files") return;

      const ackText = uploadAck(names.length);

      const orb = stateRef.current.orbState;
      if (orb === "speaking" || orb === "thinking") {
        // Defer until the assistant's current utterance ends
        pendingAckRef.current = ackText;
        return;
      }
      // Idle or listening: stop listening if active and speak the ack
      stopListening();
      speakAssistant(ackText, true);
    },
    [speakAssistant, stopListening]
  );

  useEffect(() => {
    return () => {
      cancelSpeak();
      stopListening();
    };
  }, [stopListening]);

  const isFilesStep = step === "files";
  const fileCount = answers.uploaded_files?.length ?? 0;
  const fileFindings = isFilesStep
    ? analyzeFiles(answers.uploaded_files ?? [])
    : null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="glass rounded-3xl p-6 sm:p-10 shadow-soft animate-fade-in">
        <Header
          onReset={handleReset}
          muted={muted}
          onToggleMute={() => {
            const next = !muted;
            setMuted(next);
            if (next) cancelSpeak();
          }}
        />

        <div className="mt-6">
          <ProgressSteps current={step} />
        </div>

        <div className="mt-10 flex flex-col items-center gap-8">
          <VoiceOrb state={orbState} onClick={handleOrbClick} />

          {!started && (
            <div className="text-center max-w-md animate-fade-in-up">
              <h2 className="text-ink-800 text-xl font-semibold mb-2">
                تقييم مبدئي للحقن المجهري
              </h2>
              <p className="text-ink-500 text-sm leading-relaxed">
                اضغطي على الميكروفون وهاسألك شوية أسئلة بسيطة. جاوبي بصوتك بالراحة،
                وفي الآخر هاقدملك تقرير مبدئي.
              </p>
            </div>
          )}

          {error && (
            <div className="w-full rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 animate-fade-in">
              {error}
            </div>
          )}
        </div>

        {(started || messages.length > 0) && (
          <div className="mt-8 border-t border-ink-100 pt-6 space-y-5">
            <TranscriptPanel messages={messages} interim={interim} />

            {isFilesStep && (
              <UploadHint
                count={fileCount}
                findings={fileFindings?.detections ?? []}
              />
            )}

            <FileUpload
              files={answers.uploaded_files ?? []}
              onFilesChange={handleFilesChange}
              highlighted={isFilesStep}
            />

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                onClick={handleReset}
                className="text-xs text-ink-500 hover:text-ink-700 transition"
              >
                إعادة البدء
              </button>
              {step !== "intro" && step !== "done" && (
                <button
                  onClick={handleSkipToReport}
                  className="text-xs text-brand-700 hover:text-brand-900 underline-offset-2 hover:underline transition"
                >
                  عرض التقرير الحالي →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-[11px] text-ink-400">
        ده عرض توضيحي لأغراض العرض فقط ولا يغني عن استشارة الطبيب المختص.
      </p>
    </div>
  );
}

function UploadHint({
  count,
  findings,
}: {
  count: number;
  findings: { filename: string; tags: string[] }[];
}) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/70 to-mint-50/70 p-4 text-sm text-ink-700 animate-fade-in-up">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-ink-800">
          {count === 0
            ? "لو عندك تحاليل أو أشعة، ارفعيها دلوقتي ◆ هترفع دقة التقييم."
            : `استلمت ${count} ملف. تقدري ترفعي تاني، ولما تخلصي قولي "خلصت".`}
        </p>
      </div>

      {findings.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {findings.map((f) => (
            <li
              key={f.filename}
              className="flex items-start gap-2 text-xs text-ink-600"
            >
              <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
              <span className="truncate">
                <span className="font-medium text-ink-800">{f.filename}</span>
                {" — "}
                <span className="text-mint-700">{f.tags.join(" · ")}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Header({
  onReset,
  muted,
  onToggleMute,
}: {
  onReset: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-2xl bg-gradient-to-br from-brand-500 to-mint-400 shadow-soft flex items-center justify-center text-white">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.65-7 10-7 10Z" />
          </svg>
        </div>
        <div className="leading-tight">
          <p className="text-ink-800 font-semibold">المساعد الذكي</p>
          <p className="text-ink-500 text-xs">تقييم مبدئي لأطفال الأنابيب</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleMute}
          title={muted ? "تشغيل الصوت" : "كتم الصوت"}
          className="rounded-xl border border-ink-200 bg-white/70 px-3 py-2 text-xs text-ink-700 hover:bg-white transition"
        >
          {muted ? "🔇 مكتوم" : "🔊 صوت"}
        </button>
      </div>
    </div>
  );
}
