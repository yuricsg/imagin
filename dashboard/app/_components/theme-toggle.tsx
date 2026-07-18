"use client";

import { useTheme } from "./theme-provider";
import { IconMonitor, IconMoon, IconSun } from "./icons";
import { THEME_LABELS, type Theme } from "@/lib/theme";

const ORDER: Theme[] = ["light", "dark", "system"];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Tema da interface"
      className="flex items-center rounded-lg border border-zinc-200/80 bg-white/60 p-0.5 dark:border-zinc-700/80 dark:bg-zinc-900/50"
    >
      {ORDER.map((value) => {
        const selected = theme === value;
        const Icon =
          value === "light" ? IconSun : value === "dark" ? IconMoon : IconMonitor;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={selected}
            aria-label={THEME_LABELS[value]}
            title={THEME_LABELS[value]}
            className={`flex size-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/45 ${
              selected
                ? "bg-teal-600 text-white shadow-sm dark:bg-teal-600"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
