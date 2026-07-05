export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "imagin:theme";

export function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function resolveDark(theme: Theme, prefersDark: boolean): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return prefersDark;
}

export function applyThemeClass(theme: Theme): boolean {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = resolveDark(theme, prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  return dark;
}

export const THEME_LABELS: Record<Theme, string> = {
  light: "Claro",
  dark: "Escuro",
  system: "Sistema",
};
