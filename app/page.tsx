import HopeBackdrop from "@/components/HopeBackdrop";
import PhotoBackdrop from "@/components/PhotoBackdrop";
import VoiceSession from "@/components/VoiceSession";

export default function HomePage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <PhotoBackdrop />
      <HopeBackdrop variant="soft" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:py-16">
        <VoiceSession />
      </div>
    </main>
  );
}
