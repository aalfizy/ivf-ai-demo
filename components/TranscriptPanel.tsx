"use client";

import type { ChatMessage } from "@/lib/types";
import { useEffect, useRef } from "react";

export default function TranscriptPanel({
  messages,
  interim,
}: {
  messages: ChatMessage[];
  interim?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, interim]);

  return (
    <div
      ref={ref}
      className="nice-scroll max-h-60 overflow-y-auto space-y-2 pr-1"
    >
      {messages.map((m) => (
        <div
          key={m.id}
          className={[
            "flex animate-fade-in-up",
            m.role === "assistant" ? "justify-start" : "justify-end",
          ].join(" ")}
        >
          <div
            className={[
              "max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
              m.role === "assistant"
                ? "bg-white/80 text-ink-800 border border-brand-100 shadow-sm"
                : "bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow",
            ].join(" ")}
          >
            {m.text}
          </div>
        </div>
      ))}
      {interim && (
        <div className="flex justify-end animate-fade-in">
          <div className="max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed bg-brand-50 text-ink-600 border border-dashed border-brand-300">
            {interim}
          </div>
        </div>
      )}
    </div>
  );
}
