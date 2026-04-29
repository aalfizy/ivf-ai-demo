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
  /**
   * When mobile-browser autoplay policy blocks audio playback we surface
   * a manual "🔊 تشغيل الصوت" button. Tapping it provides a fresh user
   * gesture so the queued phrase can be re-spoken.
   */
  const [blockedAudio, setBlockedAudio] = useState<{
    text: string;
    autoListen: boolean;
  } | null>(null);

  const stopListeningRef = useRef<null | (() => void)>(null);
  const stateRef = useRef({ step, answers, muted, orbState });
  stateRef.current = { step, answers, muted, orbState };

  // Pending speech queue (used so file-upload acks don't interrupt mid-question speech).
  const pendingAckRef = useRef<string | null>(null);

  /**
   * Mobile browsers (especially iOS Safari) only allow programmatic
   * audio playback after a synchronous play() call inside a user
   * gesture. We "unlock" the audio output by playing a tiny silent WAV
   * the first time the user taps the orb — once unlocked, every later
   * `Audio.play()` in the session is permitted.
   */
  const audioUnlockedRef = useRef(false);
  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    try {
      const a = new Audio();
      // 0.1s of pure silence (44.1kHz mono PCM) inlined as a data URI.
      a.src =
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
      a.volume = 0;
      a.muted = true;
      const p = a.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          console.log("[Audio] unlocked (silent buffer played)");
          try {
            a.pause();
            a.src = "";
          } catch {
            /* ignore */
          }
        }).catch((err) => {
          console.warn(
            `[Audio] unlock attempt rejected: ${err?.name ?? "Error"}`
          );
        });
      }
    } catch (err) {
      console.warn("[Audio] unlock attempt threw:", err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSupported(isRecognitionSupported());
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
      // Per-sentence debug log — operators can tail the browser console
      // during the demo to see exactly which line is being spoken.
      console.log(
        `[Assistant] step=${stateRef.current.step} autoListen=${autoListen}\n  > ${text}`
      );
      pushMessage("assistant", text);
      setOrbState("speaking");
      // Whenever we start a new utterance, dismiss any stale blocked-audio
      // prompt — this attempt itself may succeed (or be the new failure).
      setBlockedAudio(null);

      // Track whether this attempt was killed by browser autoplay policy.
      // If so, we DO NOT advance the conversation; we wait for the user
      // to tap the manual play button (which calls speakAssistant again).
      let autoplayWasBlocked = false;

      const finish = () => {
        if (autoplayWasBlocked) {
          // Stay frozen on the "speaking" orb so the user understands the
          // assistant is waiting on them. The fallback button drives the
          // next step.
          return;
        }
        // Flush any queued upload-ack first
        const queued = pendingAckRef.current;
        pendingAckRef.current = null;
        if (queued) {
          setTimeout(() => speakAssistant(queued, autoListen), 250);
          return;
        }
        setOrbState("idle");
        if (autoListen) setTimeout(() => beginListening(), 400);
      };

      if (stateRef.current.muted) {
        console.log("[Assistant] muted — skipping TTS, advancing flow");
        setTimeout(finish, 600);
        return;
      }

      // Task 1: stop the mic explicitly before speaking, so iOS releases
      // the input audio session and routes output to the speaker.
      stopListening();

      await speak(text, {
        lang: "ar-EG",
        rate: 0.95,
        onAutoplayBlocked: () => {
          autoplayWasBlocked = true;
          console.warn(
            "[Assistant] autoplay blocked — surfacing manual play button"
          );
          setBlockedAudio({ text, autoListen });
        },
        onEnd: finish,
        onError: finish,
      });
    },
    [beginListening, pushMessage, stopListening]
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
        "المتصفح ده مش بيدعم التعرف على الصوت. جرّبي Google Chrome أو Edge على كمبيوتر أو أندرويد."
      );
      return;
    }

    // Mobile audio unlock — must run synchronously inside the user-gesture
    // handler. Plays a tiny silent buffer so subsequent (deferred) audio
    // playback is permitted by iOS Safari / mobile Chrome autoplay rules.
    unlockAudio();

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
    unlockAudio,
  ]);

  /**
   * User tapped the "🔊 تشغيل الصوت" fallback button. This is a fresh user
   * gesture, so we re-attempt audio unlock and replay the blocked phrase.
   */
  const handleManualPlay = useCallback(() => {
    if (!blockedAudio) return;
    console.log("[Audio] manual play button tapped — retrying utterance");
    audioUnlockedRef.current = false; // force a fresh unlock
    unlockAudio();
    const { text, autoListen } = blockedAudio;
    setBlockedAudio(null);
    speakAssistant(text, autoListen);
  }, [blockedAudio, speakAssistant, unlockAudio]);

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
    setBlockedAudio(null);
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

          {blockedAudio && (
            <button
              type="button"
              onClick={handleManualPlay}
              className="animate-fade-in-up flex items-center gap-2 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 px-5 py-3 text-white shadow-soft hover:shadow-md hover:scale-[1.02] active:scale-[0.99] transition text-sm font-semibold"
              aria-label="تشغيل الصوت"
            >
              <span className="text-lg">🔊</span>
              <span>تشغيل الصوت</span>
            </button>
          )}

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
