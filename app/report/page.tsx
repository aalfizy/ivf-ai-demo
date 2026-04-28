import HopeBackdrop from "@/components/HopeBackdrop";
import ReportView from "@/components/ReportView";

export default function ReportPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <HopeBackdrop variant="rich" />
      <div className="relative z-10 flex min-h-screen items-start justify-center px-4 py-10 sm:py-14">
        <ReportView />
      </div>
    </main>
  );
}
