function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800 ${className}`}
    />
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      {children}
    </div>
  );
}

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando painel"
      className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8"
    >
      <div className="space-y-2">
        <Bar className="h-5 w-40" />
        <Bar className="h-3.5 w-72 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <CardShell key={i}>
            <Bar className="h-3 w-24" />
            <Bar className="mt-3 h-7 w-16" />
            <Bar className="mt-2 h-3 w-20" />
          </CardShell>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 lg:col-span-2">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <Bar className="h-4 w-28" />
          </div>
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <Bar className="h-8 w-full" />
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <Bar className="size-7 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Bar className="h-3.5 w-40 max-w-full" />
                  <Bar className="h-3 w-28" />
                </div>
                <Bar className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <Bar className="h-4 w-24" />
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3">
                  <Bar className="size-9 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Bar className="h-3.5 w-32 max-w-full" />
                    <Bar className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <CardShell>
            <Bar className="h-24 w-full" />
          </CardShell>
        </div>
      </div>
    </div>
  );
}
