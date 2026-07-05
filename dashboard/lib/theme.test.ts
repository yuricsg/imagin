import { describe, expect, it } from "vitest";
import {
  applyThemeClass,
  isTheme,
  readStoredTheme,
  resolveDark,
  THEME_STORAGE_KEY,
} from "./theme";

describe("theme", () => {
  it("recognises valid theme values", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(true);
    expect(isTheme("invalid")).toBe(false);
  });

  it("resolves dark mode from theme preference", () => {
    expect(resolveDark("dark", false)).toBe(true);
    expect(resolveDark("light", true)).toBe(false);
    expect(resolveDark("system", true)).toBe(true);
    expect(resolveDark("system", false)).toBe(false);
  });

  it("persists theme in localStorage", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(readStoredTheme()).toBe("dark");
    localStorage.removeItem(THEME_STORAGE_KEY);
    expect(readStoredTheme()).toBe("system");
  });

  it("toggles the dark class on the document element", () => {
    applyThemeClass("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    applyThemeClass("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
