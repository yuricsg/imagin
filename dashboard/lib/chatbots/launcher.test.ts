import { describe, expect, it } from "vitest";
import {
  buildLauncherFromInput,
  DEFAULT_LAUNCHER,
  DEFAULT_LAUNCHER_AVATAR_PATH,
  LAUNCHER_AVATAR_PRESETS,
  matchLauncherAvatarPreset,
  normalizeLauncher,
  normalizeLauncherTeaserTexts,
  resolveLauncherAvatarPath,
  resolveLauncherAvatarUrl,
} from "./launcher";

describe("launcher helpers", () => {
  it("falls back to the default teaser when empty", () => {
    expect(normalizeLauncherTeaserTexts([])).toEqual(
      DEFAULT_LAUNCHER.teaserTexts,
    );
    expect(normalizeLauncherTeaserTexts(["  ", ""])).toEqual(
      DEFAULT_LAUNCHER.teaserTexts,
    );
  });

  it("trims and dedupes teaser lines", () => {
    expect(
      normalizeLauncherTeaserTexts(["  Olá  ", "Olá", "Agende agora"]),
    ).toEqual(["Olá", "Agende agora"]);
  });

  it("normalizes missing launcher to defaults", () => {
    expect(normalizeLauncher(undefined)).toEqual({
      teaserTexts: [...DEFAULT_LAUNCHER.teaserTexts],
      avatarUrl: null,
    });
  });

  it("migrates the old photorealistic default to the cartoon robot", () => {
    expect(
      normalizeLauncher({
        teaserTexts: ["Oi"],
        avatarUrl: "/embed/default-avatar.png",
      }),
    ).toEqual({ teaserTexts: ["Oi"], avatarUrl: null });
  });

  it("resolves default avatar against the app origin", () => {
    expect(
      resolveLauncherAvatarUrl(
        { teaserTexts: ["Oi"], avatarUrl: null },
        "https://app.imagin.app/",
      ),
    ).toBe(`https://app.imagin.app${DEFAULT_LAUNCHER_AVATAR_PATH}`);
    expect(DEFAULT_LAUNCHER_AVATAR_PATH).toBe("/embed/robot-helper.png");
  });

  it("resolves preset paths relative to the app origin", () => {
    expect(
      resolveLauncherAvatarUrl(
        {
          teaserTexts: ["Oi"],
          avatarUrl: "/embed/robot-helper-feminine.png",
        },
        "https://app.imagin.app",
      ),
    ).toBe("https://app.imagin.app/embed/robot-helper-feminine.png");
  });

  it("prefers an absolute custom avatar URL when set", () => {
    expect(
      resolveLauncherAvatarUrl(
        {
          teaserTexts: ["Oi"],
          avatarUrl: "https://cdn.example.com/photo.jpg",
        },
        "https://app.imagin.app",
      ),
    ).toBe("https://cdn.example.com/photo.jpg");
  });

  it("matches built-in avatar presets", () => {
    expect(matchLauncherAvatarPreset(null)).toBe("robot");
    expect(matchLauncherAvatarPreset("/embed/robot-helper-feminine.png")).toBe(
      "robot-feminine",
    );
    expect(LAUNCHER_AVATAR_PRESETS).toHaveLength(2);
  });

  it("builds launcher from form input and collapses default path to null", () => {
    expect(
      buildLauncherFromInput({
        launcherTeaserTexts: ["A", "B"],
        launcherAvatarUrl: DEFAULT_LAUNCHER_AVATAR_PATH,
      }),
    ).toEqual({ teaserTexts: ["A", "B"], avatarUrl: null });
    expect(
      buildLauncherFromInput({
        launcherTeaserTexts: ["A"],
        launcherAvatarUrl: "/embed/robot-helper-feminine.png",
      }),
    ).toEqual({
      teaserTexts: ["A"],
      avatarUrl: "/embed/robot-helper-feminine.png",
    });
  });

  it("resolves preview paths for relative and absolute URLs", () => {
    expect(resolveLauncherAvatarPath(null)).toBe(DEFAULT_LAUNCHER_AVATAR_PATH);
    expect(resolveLauncherAvatarPath("/embed/robot-helper-feminine.png")).toBe(
      "/embed/robot-helper-feminine.png",
    );
  });
});
