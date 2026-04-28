"use client";

import { useMemo } from "react";

type State = "idle" | "listening" | "thinking" | "speaking";

export default function VoiceOrb({
  state,
  onClick,
  disabled,
}: {
  state: State;
  onClick: () => void;
  disabled?: boolean;
}) {
  const label = useMemo(() => {
    switch (state) {
      case "listening":
        return "بتسمعك دلوقتي…";
      case "thinking":
        return "بتفكر…";
      case "speaking":
        return "بترد عليكي…";
      default:
        return "اضغطي علشان تبدأي الكلام";
    }
  }, [state]);

  const showRings = state === "listening" || state === "speaking";

  return (
    <div className="flex flex-col items-center gap-5 select-none">
      <div className="relative flex items-center justify-center">
        {showRings && (
          <>
            <span className="pointer-events-none absolute inline-flex h-56 w-56 rounded-full bg-brand-400/30 animate-pulse-ring" />
            <span
              className="pointer-events-none absolute inline-flex h-56 w-56 rounded-full bg-mint-400/30 animate-pulse-ring"
              style={{ animationDelay: "0.6s" }}
            />
            <span
              className="pointer-events-none absolute inline-flex h-56 w-56 rounded-full bg-brand-300/30 animate-pulse-ring"
              style={{ animationDelay: "1.2s" }}
            />
          </>
        )}

        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={[
            "relative z-10 flex items-center justify-center",
            "h-40 w-40 rounded-full",
            "bg-gradient-to-br from-brand-500 via-brand-400 to-mint-400",
            "text-white shadow-soft ring-1 ring-white/40",
            "transition-transform duration-200",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            state === "listening" ? "animate-pulse-soft" : "",
            state === "idle" ? "hover:scale-105 active:scale-95" : "",
          ].join(" ")}
        >
          {state === "thinking" ? (
            <ThinkingDots />
          ) : state === "speaking" ? (
            <SoundwaveIcon />
          ) : (
            <MicIcon />
          )}
        </button>
      </div>

      <div className="text-center">
        <p className="text-ink-600 text-sm tracking-wide">{label}</p>
        {state === "listening" && <WaveBars />}
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function SoundwaveIcon() {
  return (
    <svg
      width="68"
      height="68"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="4" y1="12" x2="4" y2="12">
        <animate
          attributeName="y1"
          values="10;6;10"
          dur="0.9s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="y2"
          values="14;18;14"
          dur="0.9s"
          repeatCount="indefinite"
        />
      </line>
      <line x1="9" y1="8" x2="9" y2="16">
        <animate
          attributeName="y1"
          values="8;4;8"
          dur="1.1s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="y2"
          values="16;20;16"
          dur="1.1s"
          repeatCount="indefinite"
        />
      </line>
      <line x1="14" y1="6" x2="14" y2="18">
        <animate
          attributeName="y1"
          values="6;10;6"
          dur="0.8s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="y2"
          values="18;14;18"
          dur="0.8s"
          repeatCount="indefinite"
        />
      </line>
      <line x1="19" y1="9" x2="19" y2="15">
        <animate
          attributeName="y1"
          values="9;5;9"
          dur="1s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="y2"
          values="15;19;15"
          dur="1s"
          repeatCount="indefinite"
        />
      </line>
    </svg>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full bg-white animate-pulse" />
      <span
        className="h-3 w-3 rounded-full bg-white animate-pulse"
        style={{ animationDelay: "0.2s" }}
      />
      <span
        className="h-3 w-3 rounded-full bg-white animate-pulse"
        style={{ animationDelay: "0.4s" }}
      />
    </div>
  );
}

function WaveBars() {
  return (
    <div className="mt-4 flex h-8 items-end justify-center gap-1" aria-hidden>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <span
          key={i}
          className="inline-block w-1 rounded-full bg-brand-500/70 animate-wave"
          style={{
            height: "100%",
            animationDelay: `${(i % 5) * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}
