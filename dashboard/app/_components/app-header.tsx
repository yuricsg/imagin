import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";
import { CommandKButton } from "./command-k-button";
import { SignOutButton } from "./sign-out-button";

/** Two letters for the avatar bubble, from the operator's name or email. */
function operatorInitials(label: string): string {
  const parts = label.trim().split(/[\s@.]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[1][0] : "";
  return (first + second).toUpperCase() || "?";
}

export async function AppHeader() {
  const session = await auth();
  // Anonymous requests (login page, widget embeds on client sites) get no
  // operator chrome — only signed-in operators see the dashboard header.
  if (!session?.user) return null;

  const label = session.user.name || session.user.email || "Usuário";

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/95 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/85">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex min-w-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/45"
        >
          <span className="rounded-lg bg-black px-2.5 py-1.5 ring-1 ring-zinc-900/10 dark:ring-zinc-700/50">
            <Image
              src="/imagin-logo.png"
              alt="Imagin — Marketing Digital para Médicos"
              width={626}
              height={150}
              priority
              className="h-7 w-auto max-w-[min(100%,10rem)] object-contain object-left sm:h-8 sm:max-w-none"
            />
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <CommandKButton />
          <ThemeToggle />
          <span
            className="hidden max-w-48 truncate rounded-full border border-zinc-200/80 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700/80 dark:bg-zinc-900/60 dark:text-zinc-300 sm:block"
            title={label}
          >
            {label}
          </span>
          <span
            className="flex size-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold text-white ring-2 ring-zinc-200 dark:bg-zinc-600 dark:ring-zinc-800"
            aria-hidden
          >
            {operatorInitials(label)}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
