"use client";

import type { Answers, ChatMessage, PredictionResult } from "./types";

const KEY = "ivf-demo-session-v1";

export interface SessionData {
  answers: Answers;
  prediction: PredictionResult | null;
  transcript: ChatMessage[];
  completedAt?: number;
}

export function saveSession(data: SessionData) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function loadSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
