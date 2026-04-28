"use client";

/**
 * Soft, abstract emotional backdrop.
 * Pure inline SVG — no external assets, no images, no stock photos.
 *
 * Visual language: open hands forming a circle, growing sprout, soft sunrise.
 * Conveys: support, growth, hope. Deliberately abstract (no baby imagery).
 *
 * Usage: place inside a relatively-positioned full-screen <main>, before content.
 *   <HopeBackdrop />
 *
 * Variant "rich" is slightly more visible (used on the report screen).
 */
export default function HopeBackdrop({
  variant = "soft",
}: {
  variant?: "soft" | "rich";
}) {
  const isRich = variant === "rich";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden print:hidden"
    >
      {/* Existing soft color washes */}
      <div className="absolute inset-0 bg-grid-soft [background-size:22px_22px] opacity-30" />
      <div className="absolute -top-32 -right-20 h-72 w-72 rounded-full bg-brand-300/30 blur-3xl" />
      <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-mint-300/30 blur-3xl" />

      {/* Soft sunrise — top-left, very faint */}
      <svg
        className={[
          "absolute -top-20 -left-16 sm:top-4 sm:left-4 w-56 sm:w-72",
          isRich ? "opacity-[0.18]" : "opacity-[0.12]",
        ].join(" ")}
        viewBox="0 0 200 120"
        fill="none"
      >
        <defs>
          <linearGradient id="hb-sun" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#fda4af" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="46" fill="url(#hb-sun)" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const angle = (Math.PI / 7) * (i + 0.5) - Math.PI;
          const x1 = 100 + Math.cos(angle) * 56;
          const y1 = 100 + Math.sin(angle) * 56;
          const x2 = 100 + Math.cos(angle) * 80;
          const y2 = 100 + Math.sin(angle) * 80;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Botanical sprig — top-right corner */}
      <svg
        className={[
          "absolute top-6 right-4 sm:top-8 sm:right-8 w-28 sm:w-40 rotate-12",
          isRich ? "opacity-[0.22]" : "opacity-[0.15]",
        ].join(" ")}
        viewBox="0 0 120 200"
        fill="none"
        stroke="#059669"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M60 195 C 60 150, 50 110, 60 60" />
        {[0, 1, 2, 3, 4].map((i) => {
          const y = 60 + i * 28;
          const tilt = i % 2 === 0 ? 1 : -1;
          return (
            <g key={i}>
              <path
                d={`M60 ${y} C ${60 + tilt * 30} ${y - 8}, ${60 + tilt * 36} ${
                  y - 18
                }, ${60 + tilt * 18} ${y - 26}`}
              />
              <path
                d={`M${60 + tilt * 18} ${y - 26} Q ${60 + tilt * 8} ${y - 14}, 60 ${y}`}
              />
            </g>
          );
        })}
        <circle cx="60" cy="56" r="2.5" fill="#059669" stroke="none" />
      </svg>

      {/* Open cradling hands — bottom center, very faint */}
      <svg
        className={[
          "absolute bottom-2 left-1/2 -translate-x-1/2 w-[420px] sm:w-[640px]",
          isRich ? "opacity-[0.10]" : "opacity-[0.07]",
        ].join(" ")}
        viewBox="0 0 640 220"
        fill="none"
        stroke="#0369a1"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Left palm */}
        <path d="M40 200 C 60 130, 140 110, 220 130 C 260 140, 290 150, 310 160" />
        <path d="M70 195 C 90 150, 150 145, 200 160" />
        {/* Right palm */}
        <path d="M600 200 C 580 130, 500 110, 420 130 C 380 140, 350 150, 330 160" />
        <path d="M570 195 C 550 150, 490 145, 440 160" />
        {/* Soft heart between hands */}
        <path
          d="M320 110 c -14 -22, -46 -22, -46 6 c 0 22, 30 36, 46 50 c 16 -14, 46 -28, 46 -50 c 0 -28, -32 -28, -46 -6 z"
          stroke="#e11d48"
          strokeWidth="1.4"
        />
      </svg>

      {/* Botanical sprig — bottom-left, mirrored */}
      <svg
        className={[
          "absolute bottom-6 left-4 sm:bottom-12 sm:left-8 w-24 sm:w-32 -rotate-12 scale-x-[-1]",
          isRich ? "opacity-[0.18]" : "opacity-[0.12]",
        ].join(" ")}
        viewBox="0 0 120 200"
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M60 195 C 60 150, 50 110, 60 60" />
        {[0, 1, 2, 3].map((i) => {
          const y = 70 + i * 30;
          const tilt = i % 2 === 0 ? 1 : -1;
          return (
            <path
              key={i}
              d={`M60 ${y} C ${60 + tilt * 28} ${y - 6}, ${60 + tilt * 32} ${
                y - 18
              }, ${60 + tilt * 14} ${y - 24} Q ${60 + tilt * 6} ${y - 12}, 60 ${y}`}
            />
          );
        })}
      </svg>

      {/* Tiny floating dots */}
      {[
        { top: "18%", left: "12%", size: 6, delay: "0s", color: "bg-brand-300/60" },
        { top: "32%", left: "85%", size: 4, delay: "1.2s", color: "bg-mint-300/60" },
        { top: "62%", left: "8%", size: 5, delay: "2.1s", color: "bg-rose-200/60" },
        { top: "76%", left: "78%", size: 6, delay: "0.6s", color: "bg-brand-300/60" },
        { top: "44%", left: "50%", size: 3, delay: "1.8s", color: "bg-mint-300/60" },
      ].map((d, i) => (
        <span
          key={i}
          className={`absolute rounded-full ${d.color} animate-float`}
          style={{
            top: d.top,
            left: d.left,
            width: d.size,
            height: d.size,
            animationDelay: d.delay,
          }}
        />
      ))}
    </div>
  );
}
