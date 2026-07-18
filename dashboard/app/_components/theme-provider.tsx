"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  applyThemeClass,
  readStoredTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const themeListeners = new Set<() => void>();
let cachedTheme: Theme | null = null;

function getThemeSnapshot(): Theme {
  if (cachedTheme === null) cachedTheme = readStoredTheme();
  return cachedTheme;
}

function subscribeTheme(onStoreChange: () => void) {
  themeListeners.add(onStoreChange);
  return () => {
    themeListeners.delete(onStoreChange);
  };
}

function setThemeExternal(theme: Theme) {
  cachedTheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode / quota — still apply for this session.
  }
  applyThemeClass(theme);
  for (const listener of themeListeners) listener();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    () => "system" as Theme,
  );

  useEffect(() => {
    applyThemeClass(theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange() {
      if (getThemeSnapshot() === "system") {
        applyThemeClass("system");
        for (const listener of themeListeners) listener();
      }
    }
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeExternal(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/**
 * Same as useTheme but returns null outside the provider — for components
 * (e.g. the command palette) that also render in provider-less test trees.
 */
export function useThemeOptional() {
  return useContext(ThemeContext);
}
