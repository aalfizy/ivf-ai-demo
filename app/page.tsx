import VoiceSession from "@/components/VoiceSession";

export default function HomePage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <BackgroundDecor />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:py-16">
        <VoiceSession />
      </div>
    </main>
  );
}

function BackgroundDecor() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-grid-soft [background-size:22px_22px] opacity-40" />
      <div className="pointer-events-none absolute -top-32 -right-20 h-72 w-72 rounded-full bg-brand-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-mint-300/30 blur-3xl" />
    </>
  );
}
