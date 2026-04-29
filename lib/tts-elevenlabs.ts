"use client";

/**
 * Unified Text-to-Speech client (ElevenLabs only).
 *
 * Design contract (do not relax without explicit approval):
 *
 *   1. ElevenLabs is the ONLY supported TTS engine. There is no automatic
 *      browser-speechSynthesis fallback. If ElevenLabs fails for any
 *      reason, we log loudly and resolve quietly so the conversation
 *      flow can advance — but we never produce a different-sounding
 *      voice in the same session.
 *
 *   2. Speech is SERIALIZED. A new `speak()` call enqueues; it does not
 *      interrupt the previous utterance. The only way to stop speech is
 *      `cancelSpeak()`, called explicitly by the UI on mute/reset/orb-tap.
 *
 *   3. Every spoken sentence is logged as `[Speech] "..."` so demo
 *      operators can trace exactly what was uttered.
 *
 *   4. Audio is cached per-text. Repeated phrases (intros, acks) play
 *      instantly without re-hitting the API.
 *
 * Public API:
 *   speak(text, opts?)   → enqueue a phrase; resolves when it finishes
 *   cancelSpeak()        → hard-stop current playback + clear queue
 *   prefetchSpeech(text) → warm the cache for known phrases
 */

import type { SpeakOptions } from "./speech";

export type { SpeakOptions } from "./speech";

const ELEVEN_DISABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_ELEVENLABS === "false";

let currentAudio: HTMLAudioElement | null = null;
let currentRequest: AbortController | null = null;

const audioCache = new Map<string, string>(); // text → blob URL
const inflight = new Map<string, Promise<string | null>>();
const MAX_CACHE = 60;

// ---------- Sequential speech queue --------------------------------------

interface QueueItem {
  text: string;
  opts: SpeakOptions;
  resolve: () => void;
  cancelled: boolean;
}

const queue: QueueItem[] = [];
let processing = false;

/**
 * Enqueue a phrase to be spoken. Resolves when the phrase finishes
 * playing (or fails / is cancelled). Calls do NOT interrupt each other.
 */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    opts.onError?.();
    return Promise.resolve();
  }

  console.log(`[Speech] queue+ "${preview(trimmed)}"`);

  return new Promise<void>((resolve) => {
    const item: QueueItem = { text: trimmed, opts, resolve, cancelled: false };
    queue.push(item);
    void processQueue();
  });
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      if (item.cancelled) {
        item.resolve();
        continue;
      }
      try {
        await speakOne(item.text, item.opts);
      } catch (err) {
        console.error("[Speech] speakOne threw:", err);
        item.opts.onError?.();
      }
      item.resolve();
    }
  } finally {
    processing = false;
  }
}

async function speakOne(text: string, opts: SpeakOptions): Promise<void> {
  console.log(`[Speech] ▶ "${preview(text)}"`);

  if (ELEVEN_DISABLED) {
    // Strict mode — no browser fallback. Just log and resolve quietly so
    // the conversation flow advances; the operator sees the warning.
    console.warn(
      "[Speech] ElevenLabs disabled via NEXT_PUBLIC_USE_ELEVENLABS=false — utterance skipped (no browser fallback by design)."
    );
    opts.onEnd?.();
    return;
  }

  const url = await fetchElevenAudio(text);
  if (url) {
    return playUrl(url, opts);
  }

  // ElevenLabs failed for this phrase. We do NOT fall back to the browser
  // voice — that would break voice consistency. We log and resolve so the
  // conversation can move on.
  console.error(
    `[Speech] ✗ ElevenLabs failed for "${preview(text)}" — ` +
      "no fallback by design (NEXT_PUBLIC_USE_ELEVENLABS controls this)."
  );
  opts.onEnd?.();
}

// ---------- ElevenLabs fetch + cache -------------------------------------

async function fetchElevenAudio(text: string): Promise<string | null> {
  const cached = audioCache.get(text);
  if (cached) {
    console.log(`[Speech] cache hit "${preview(text)}"`);
    return cached;
  }

  const existing = inflight.get(text);
  if (existing) return existing;

  const controller = new AbortController();
  currentRequest = controller;

  const promise = (async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!res.ok) {
        let detail = "";
        try {
          detail = (await res.text()).slice(0, 240);
        } catch {
          /* ignore */
        }
        console.error(
          `[Speech] /api/tts HTTP ${res.status} — ${detail || "(no body)"}`
        );
        return null;
      }
      const blob = await res.blob();
      if (!blob || blob.size === 0) {
        console.error("[Speech] /api/tts returned empty audio body.");
        return null;
      }
      const url = URL.createObjectURL(blob);
      cacheUrl(text, url);
      return url;
    } catch (err) {
      const aborted = (err as { name?: string })?.name === "AbortError";
      if (!aborted) console.error("[Speech] /api/tts fetch threw:", err);
      return null;
    } finally {
      inflight.delete(text);
    }
  })();

  inflight.set(text, promise);
  return promise;
}

function cacheUrl(text: string, url: string) {
  if (audioCache.size >= MAX_CACHE) {
    const oldestKey = audioCache.keys().next().value;
    if (oldestKey !== undefined) {
      const oldUrl = audioCache.get(oldestKey);
      if (oldUrl) {
        try {
          URL.revokeObjectURL(oldUrl);
        } catch {
          /* ignore */
        }
      }
      audioCache.delete(oldestKey);
    }
  }
  audioCache.set(text, url);
}

// ---------- Audio playback -----------------------------------------------

function playUrl(url: string, opts: SpeakOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    const audio = new Audio(url);
    currentAudio = audio;

    audio.volume = opts.volume ?? 1.0;
    // Slightly slower playback for Arabic clarity.
    audio.playbackRate = opts.rate ?? 0.95;
    audio.preload = "auto";

    let settled = false;
    const finish = (errored: boolean) => {
      if (settled) return;
      settled = true;
      if (currentAudio === audio) currentAudio = null;
      if (errored) opts.onError?.();
      else opts.onEnd?.();
      resolve();
    };

    audio.onplay = () => opts.onStart?.();
    audio.onended = () => finish(false);
    audio.onerror = () => {
      console.warn("[Speech] HTMLAudioElement error event fired.");
      finish(true);
    };

    audio.play().catch((err) => {
      console.warn("[Speech] audio.play() rejected:", err);
      finish(true);
    });
  });
}

// ---------- Public controls ----------------------------------------------

/** Hard-stop: cancels in-flight request, current audio, and all queued items. */
export function cancelSpeak(): void {
  if (queue.length > 0) {
    console.log(`[Speech] cancel — dropping ${queue.length} queued item(s)`);
  }
  for (const item of queue) item.cancelled = true;
  queue.length = 0;

  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {
      /* ignore */
    }
    try {
      currentAudio.src = "";
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
  if (currentRequest) {
    try {
      currentRequest.abort();
    } catch {
      /* ignore */
    }
    currentRequest = null;
  }
}

export function isElevenLabsAvailable(): boolean {
  return !ELEVEN_DISABLED;
}

/** Pre-warm a known phrase so the first click feels instant. */
export function prefetchSpeech(text: string): void {
  const trimmed = text.trim();
  if (!trimmed || ELEVEN_DISABLED) return;
  if (audioCache.has(trimmed) || inflight.has(trimmed)) return;
  void fetchElevenAudio(trimmed);
}

// ---------- Internal helpers ---------------------------------------------

function preview(text: string): string {
  const t = text.replace(/\s+/g, " ");
  return t.length > 80 ? t.slice(0, 80) + "…" : t;
}
