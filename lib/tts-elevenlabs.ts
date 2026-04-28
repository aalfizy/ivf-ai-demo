"use client";

/**
 * Unified Text-to-Speech client.
 *
 * - Tries ElevenLabs first (via /api/tts proxy — API key never reaches the browser)
 * - Falls back automatically to window.speechSynthesis on failure
 * - Caches generated audio per text so repeated phrases (acks, etc.) are instant
 *
 * Public API:
 *   speak(text, opts?)   → unified speak with fallback
 *   cancelSpeak()        → stop any in-flight playback
 */

import {
  browserSpeak,
  cancelBrowserSpeech,
  isSynthesisSupported,
  type SpeakOptions,
} from "./speech";

export type { SpeakOptions } from "./speech";

const ELEVEN_DISABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_ELEVENLABS === "false";

let serviceAvailable = !ELEVEN_DISABLED;
let currentAudio: HTMLAudioElement | null = null;
let currentRequest: AbortController | null = null;

const audioCache = new Map<string, string>(); // text → blob URL
const inflight = new Map<string, Promise<string | null>>();
const MAX_CACHE = 60;

/** Fetch (or reuse) an ElevenLabs MP3 blob URL for the given text. */
async function fetchElevenAudio(text: string): Promise<string | null> {
  const cached = audioCache.get(text);
  if (cached) return cached;

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
        // Missing key / config → permanently disable for this session
        if (res.status === 500) serviceAvailable = false;
        // 401/403 from upstream forwarded as 502 — disable too
        if (res.status === 502) serviceAvailable = false;
        return null;
      }
      const blob = await res.blob();
      if (!blob || blob.size === 0) return null;
      const url = URL.createObjectURL(blob);
      cacheUrl(text, url);
      return url;
    } catch {
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
    // Evict oldest
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

/**
 * Unified speak. Plays via ElevenLabs (high quality, network) or
 * falls back to the browser voice if the network/API fails.
 *
 * Auto-plays — call site doesn't need to do anything else.
 */
export async function speak(
  text: string,
  opts: SpeakOptions = {}
): Promise<void> {
  cancelSpeak();

  const trimmed = text.trim();
  if (!trimmed) {
    opts.onError?.();
    return;
  }

  if (serviceAvailable) {
    const url = await fetchElevenAudio(trimmed);
    if (url) {
      return playUrl(url, opts);
    }
    // ElevenLabs failed — fall through to browser fallback
  }

  if (isSynthesisSupported()) {
    return browserSpeak(trimmed, { ...opts, rate: opts.rate ?? 0.95 });
  }
  opts.onError?.();
}

function playUrl(url: string, opts: SpeakOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    const audio = new Audio(url);
    currentAudio = audio;

    audio.volume = opts.volume ?? 1.0;
    // Slightly slower for warmth + clarity; ElevenLabs already paces well.
    audio.playbackRate = opts.rate ?? 0.95;
    audio.preload = "auto";

    let settled = false;
    const finish = (errored: boolean) => {
      if (settled) return;
      settled = true;
      currentAudio = null;
      if (errored) opts.onError?.();
      else opts.onEnd?.();
      resolve();
    };

    audio.onplay = () => opts.onStart?.();
    audio.onended = () => finish(false);
    audio.onerror = () => finish(true);

    audio.play().catch(() => finish(true));
  });
}

/** Stop any in-flight ElevenLabs request and any audio playback. */
export function cancelSpeak() {
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
  cancelBrowserSpeech();
}

/** Whether the ElevenLabs path is currently believed to be reachable. */
export function isElevenLabsAvailable(): boolean {
  return serviceAvailable;
}

/**
 * Pre-warm a text by fetching its audio in the background.
 * Optional optimization for known phrases (intro, common acks).
 */
export function prefetchSpeech(text: string): void {
  const trimmed = text.trim();
  if (!trimmed || !serviceAvailable) return;
  if (audioCache.has(trimmed) || inflight.has(trimmed)) return;
  void fetchElevenAudio(trimmed);
}
