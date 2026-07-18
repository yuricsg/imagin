import { Skeleton } from "./_components/ui";
import { MetricsRowSkeleton } from "./_components/metrics-row";
import { LeadsTableSkeleton } from "./_components/leads-table";
import { ChatbotListSkeleton } from "./_components/chatbot-list";
import { RobotLoader } from "./_components/robot-loader";

/**
 * Route-level loading shell. The dashboard data is 100% server-loaded, so this
 * is the one place skeletons are actually rendered — the `*Skeleton` exports
 * from each widget keep the placeholder in sync with the real layout. The
 * RobotLoader hero on top gives the wait a personality + sense of progress.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando painel"
      className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8"
    >
      <RobotLoader />

      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <MetricsRowSkeleton />

      <div className="grid gap-6 lg:grid-cols-3">
        <section
          aria-hidden="true"
          className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/80 dark:bg-zinc-900/70 lg:col-span-2"
        >
          <header className="flex items-center justify-between gap-2 border-b border-zinc-200/80 px-5 py-4 dark:border-zinc-800/80">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-24" />
          </header>
          <div className="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800/80">
            <Skeleton className="h-9 w-full" />
          </div>
          <LeadsTableSkeleton rows={6} />
        </section>

        <div className="space-y-6">
          <section
            aria-hidden="true"
            className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/80 dark:bg-zinc-900/70"
          >
            <header className="flex items-center justify-between gap-2 border-b border-zinc-200/80 px-4 py-3.5 dark:border-zinc-800/80">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-20 rounded-lg" />
            </header>
            <ChatbotListSkeleton rows={3} />
          </section>
          <div
            aria-hidden="true"
            className="rounded-xl border border-dashed border-zinc-300/80 bg-white p-5 dark:border-zinc-700/80 dark:bg-zinc-900/60"
          >
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
