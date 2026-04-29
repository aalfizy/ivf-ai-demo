"use client";

/**
 * Browser-side speech I/O wrappers (Web Speech API).
 *
 * - `startListening()` uses SpeechRecognition (STT)
 * - `browserSpeak()` uses window.speechSynthesis (TTS, fallback only)
 *
 * The unified TTS entrypoint is `speak()` in `lib/tts-elevenlabs.ts`,
 * which calls ElevenLabs first and uses `browserSpeak` as fallback.
 */

export type SpeechLang = "ar-EG" | "ar-SA" | "en-US";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function getRecognitionCtor(): Any {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: Any;
    webkitSpeechRecognition?: Any;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function isSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// ---------- STT ----------

export interface ListenOptions {
  lang?: SpeechLang;
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
  onStart?: () => void;
}

export function startListening(opts: ListenOptions): () => void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    opts.onError?.("not_supported");
    return () => {};
  }
  const rec: Any = new Ctor();
  rec.lang = opts.lang ?? "ar-EG";
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let finalText = "";
  let stopped = false;
  let finalized = false;

  rec.onstart = () => opts.onStart?.();

  rec.onresult = (e: Any) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res: Any = e.results[i];
      const alt: Any = res && res[0];
      if (!alt) continue;
      const txt: string = alt.transcript ?? "";
      if (res.isFinal) finalText += txt;
      else interim += txt;
    }
    const combined = (finalText + " " + interim).trim();
    if (combined) opts.onInterim?.(combined);
  };

  rec.onerror = (e: Any) => opts.onError?.(e?.error || "unknown_error");

  rec.onend = () => {
    if (stopped) return;
    if (finalText.trim() && !finalized) {
      finalized = true;
      opts.onFinal(finalText.trim());
    }
    opts.onEnd?.();
  };

  try {
    rec.start();
  } catch {
    /* ignore repeated start */
  }

  return () => {
    stopped = true;
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  };
}

// ---------- Browser TTS (fallback only) ----------

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isSynthesisSupported()) return resolve([]);
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing && existing.length) return resolve(existing);
    const handler = () => {
      synth.removeEventListener("voiceschanged", handler);
      resolve(synth.getVoices() ?? []);
    };
    synth.addEventListener("voiceschanged", handler);
    setTimeout(() => resolve(synth.getVoices() ?? []), 1200);
  });
}

function pickArabicVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const egyptian = voices.find((v) => /ar-EG/i.test(v.lang));
  if (egyptian) return egyptian;
  const femaleArabic = voices.find(
    (v) =>
      /^ar/i.test(v.lang) &&
      /female|salma|hala|zeina|mayssa|laila|hoda/i.test(v.name)
  );
  if (femaleArabic) return femaleArabic;
  const anyArabic = voices.find((v) => /^ar/i.test(v.lang));
  if (anyArabic) return anyArabic;
  return null;
}

export interface SpeakOptions {
  lang?: SpeechLang;
  rate?: number;
  pitch?: number;
  volume?: number;
  onEnd?: () => void;
  onStart?: () => void;
  onError?: () => void;
  /**
   * Fired when the browser's autoplay policy blocks `audio.play()`
   * (mobile Safari / Chrome typically throw `NotAllowedError` when
   * play is invoked too far from a user gesture). The UI should
   * surface a manual "tap to play" button.
   */
  onAutoplayBlocked?: () => void;
}

/** Speak using the OS / browser voice (no network). */
export async function browserSpeak(
  text: string,
  opts: SpeakOptions = {}
): Promise<void> {
  if (!isSynthesisSupported()) {
    opts.onError?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();

  const voices = await loadVoices();
  const voice = pickArabicVoice(voices);

  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = opts.lang ?? voice?.lang ?? "ar-EG";
    // Slightly slower, warmer cadence
    utter.rate = opts.rate ?? 0.95;
    utter.pitch = opts.pitch ?? 1.05;
    utter.volume = opts.volume ?? 1.0;
    if (voice) utter.voice = voice;

    utter.onstart = () => opts.onStart?.();
    utter.onend = () => {
      opts.onEnd?.();
      resolve();
    };
    utter.onerror = () => {
      opts.onError?.();
      resolve();
    };

    try {
      synth.resume();
    } catch {
      /* ignore */
    }
    synth.speak(utter);
  });
}

export function cancelBrowserSpeech() {
  if (isSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
