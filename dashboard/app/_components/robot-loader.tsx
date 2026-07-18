import Image from "next/image";

const PHRASES = [
  "Preparando o painel…",
  "Buscando seus chatbots…",
  "Organizando os leads…",
  "Quase lá…",
];

/** Interval each phrase stays visible; must match the 10s loop in globals.css. */
const PHRASE_STEP_S = 2.5;

/**
 * Brand loading hero — the Imagin mascot "working" while the dashboard data
 * loads. Pure CSS animations (server component, zero JS). The route-level
 * `role="status"` in loading.tsx announces the loading state, so text, robot
 * and dots are decorative (aria-hidden); only the indeterminate progressbar
 * is exposed to assistive tech.
 *
 * Reduced motion (globals.css): static robot, bar fixed at 60%, single
 * "Carregando…" phrase.
 */
export function RobotLoader() {
  return (
    <div className="motion-enter flex flex-col items-center gap-4 py-10 text-center">
      <Image
        src="/embed/robot-helper.png"
        alt=""
        width={84}
        height={56}
        priority
        aria-hidden="true"
        className="motion-robot h-14 w-auto"
      />
      <div
        aria-hidden="true"
        className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300"
      >
        Carregando
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="motion-dot size-1.5 rounded-full bg-teal-600 dark:bg-teal-400"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Progresso do carregamento"
        className="h-1.5 w-56 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div className="motion-progress-fill h-full w-2/5 rounded-full bg-teal-600" />
      </div>
      <div
        aria-hidden="true"
        className="relative h-5 w-64 text-sm text-zinc-500 dark:text-zinc-400"
      >
        {PHRASES.map((phrase, index) => (
          <span
            key={phrase}
            className="motion-phrase absolute inset-0 opacity-0"
            style={{ animationDelay: `${index * PHRASE_STEP_S}s` }}
          >
            {phrase}
          </span>
        ))}
        <span className="motion-phrase-static hidden">Carregando…</span>
      </div>
    </div>
  );
}
