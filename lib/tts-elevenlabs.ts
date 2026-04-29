"use client";

/**
 * Unified Text-to-Speech client — **ElevenLabs only**.
 *
 * Design contract:
 *
 *   1. Every phrase is synthesized via `/api/tts` → ElevenLabs
 *      (`eleven_multilingual_v2`, fixed `ELEVENLABS_VOICE_ID` on the server).
 *      There is **no** browser `speechSynthesis` fallback.
 *
 *   2. If ElevenLabs is disabled (`NEXT_PUBLIC_USE_ELEVENLABS=false`),
 *      requests fail, or playback errors occur, we log loudly including
 *      `[Speech] ⚠ browser fallback NOT used (ElevenLabs-only)` and end
 *      the utterance without substitute audio.
 *
 *   3. Speech is **serialized**: `speak()` enqueues; the next phrase waits
 *      until the previous finishes. Only `cancelSpeak()` stops playback.
 *
 *   4. Debug: `[Speech] ▶` full utterance, `[Speech] ·` per sentence chunk,
 *      `[Speech] queue+`, cache hits, and explicit messages when a fallback
 *      would have applied but is disabled.
 *
 * Public API:
 *   speak(text, opts?)   → enqueue; resolves when done (or failed/skipped)
 *   cancelSpeak()        → stop audio + clear queue
 *   prefetchSpeech(text) → warm the cache
 */

import type { SpeakOptions } from "./speech";

export type { SpeakOptions } from "./speech";

const ELEVEN_DISABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_ELEVENLABS === "false";

let currentAudio: HTMLAudioElement | null = null;
let currentRequest: AbortController | null = null;

const audioCache = new Map<string, string>();
const inflight = new Map<string, Promise<FetchResult>>();
const MAX_CACHE = 60;

interface QueueItem {
  text: string;
  opts: SpeakOptions;
  resolve: () => void;
  cancelled: boolean;
}

const queue: QueueItem[] = [];
let processing = false;

export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    opts.onError?.();
    return Promise.resolve();
  }

  console.log(`[Speech] queue+ "${preview(trimmed)}"`);
  logSentenceChunks(trimmed);

  return new Promise<void>((resolve) => {
    const item: QueueItem = { text: trimmed, opts, resolve, cancelled: false };
    queue.push(item);
    void processQueue();
  });
}

/** Split on Arabic/Latin sentence boundaries and ellipsis — tashkeel-safe (no mutation). */
function logSentenceChunks(full: string): void {
  const chunks = full
    .split(/(?:[.؟!]+\s+|\s*\u2026\s*|\s*\.{3}\s*)/u)
    .map((s) => s.trim())
    .filter(Boolean);
  if (chunks.length === 0) return;
  chunks.forEach((c, i) => {
    console.log(`[Speech] · sentence ${i + 1}/${chunks.length} "${preview(c)}"`);
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
  console.log(`[Speech] ▶ full utterance "${preview(text)}"`);

  if (ELEVEN_DISABLED) {
    console.warn(
      "[Speech] ⚠ browser fallback NOT used (ElevenLabs-only) — " +
        "NEXT_PUBLIC_USE_ELEVENLABS=false; utterance skipped."
    );
    opts.onEnd?.();
    return;
  }

  const result = await fetchElevenAudio(text);
  if ("url" in result) {
    return playUrl(result.url, opts);
  }

  console.warn(
    `[Speech] ⚠ browser fallback NOT used (ElevenLabs-only) — ElevenLabs failed, reason=${result.error}`
  );
  opts.onEnd?.();
}

type FetchResult = { url: string } | { error: string };

async function fetchElevenAudio(text: string): Promise<FetchResult> {
  const cached = audioCache.get(text);
  if (cached) {
    console.log(`[Speech] cache hit "${preview(text)}"`);
    return { url: cached };
  }

  const existing = inflight.get(text);
  if (existing) return existing;

  const controller = new AbortController();
  currentRequest = controller;

  const promise = (async (): Promise<FetchResult> => {
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
        console.error(`[Speech] /api/tts HTTP ${res.status} — ${detail || "(no body)"}`);
        if (detail.includes("quota_exceeded") || res.status === 402) {
          return { error: "elevenlabs_credits_exhausted" };
        }
        if (res.status === 429) return { error: "elevenlabs_rate_limited" };
        if (res.status >= 500) return { error: "elevenlabs_upstream_5xx" };
        return { error: `elevenlabs_http_${res.status}` };
      }
      const blob = await res.blob();
      if (!blob || blob.size === 0) {
        console.error("[Speech] /api/tts returned empty audio body.");
        return { error: "elevenlabs_empty_body" };
      }
      const url = URL.createObjectURL(blob);
      cacheUrl(text, url);
      return { url };
    } catch (err) {
      const name = (err as { name?: string })?.name ?? "Error";
      if (name === "AbortError") return { error: "aborted" };
      console.error("[Speech] /api/tts fetch threw:", err);
      return { error: `network_error:${name}` };
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

const PRE_PLAY_DELAY_MS = 350;

async function playUrl(url: string, opts: SpeakOptions): Promise<void> {
  if (PRE_PLAY_DELAY_MS > 0) {
    await new Promise((r) => setTimeout(r, PRE_PLAY_DELAY_MS));
  }

  return new Promise<void>((resolve) => {
    const audio = new Audio(url);
    currentAudio = audio;

    audio.volume = opts.volume ?? 1.0;
    audio.playbackRate = opts.rate ?? 0.95;
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");

    let settled = false;
    const finish = (errored: boolean) => {
      if (settled) return;
      settled = true;
      if (currentAudio === audio) currentAudio = null;
      if (errored) opts.onError?.();
      else opts.onEnd?.();
      resolve();
    };

    audio.onplay = () => {
      console.log("[Audio] started");
      opts.onStart?.();
    };
    audio.onended = () => {
      console.log("[Audio] ended");
      finish(false);
    };
    audio.onerror = () => {
      console.error(
        `[Audio] failed — HTMLAudioElement error ` +
          `(code=${audio.error?.code} message="${audio.error?.message}")`
      );
      console.warn(
        "[Speech] ⚠ browser fallback NOT used (ElevenLabs-only) — HTMLAudio playback failed."
      );
      finish(true);
    };

    audio.play().catch((err: DOMException) => {
      const name = err?.name ?? "UnknownError";
      const message = err?.message ?? String(err);
      console.error(`[Audio] failed — play() rejected: ${name}: ${message}`);

      if (name === "NotAllowedError" || name === "NotSupportedError") {
        console.warn(
          "[Audio] autoplay blocked — surfacing manual play button (still ElevenLabs-only)."
        );
        opts.onAutoplayBlocked?.();
      }

      finish(true);
    });
  });
}

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

export function prefetchSpeech(text: string): void {
  const trimmed = text.trim();
  if (!trimmed || ELEVEN_DISABLED) return;
  if (audioCache.has(trimmed) || inflight.has(trimmed)) return;
  void fetchElevenAudio(trimmed);
}

function preview(text: string): string {
  const t = text.replace(/\s+/g, " ");
  return t.length > 80 ? t.slice(0, 80) + "…" : t;
}
