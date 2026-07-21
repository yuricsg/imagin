import type { ChatbotLauncherConfig } from "./types";

/** Default teaser when the operator has not customized the bubble yet. */
export const DEFAULT_LAUNCHER_TEASER = "Olá! Posso te ajudar?";

/** Built-in cartoon robot avatars served from the dashboard app origin. */
export const LAUNCHER_AVATAR_PRESETS = [
  {
    id: "robot",
    label: "Robô",
    description: "Animado e pronto para atender",
    path: "/embed/robot-helper.webp",
  },
  {
    id: "robot-feminine",
    label: "Robô feminino",
    description: "Versão mais delicada e acolhedora",
    path: "/embed/robot-helper-feminine.webp",
  },
] as const;

export type LauncherAvatarPresetId =
  (typeof LAUNCHER_AVATAR_PRESETS)[number]["id"];

/** Default avatar path (friendly cartoon robot). */
export const DEFAULT_LAUNCHER_AVATAR_PATH = LAUNCHER_AVATAR_PRESETS[0].path;

export const DEFAULT_LAUNCHER: ChatbotLauncherConfig = {
  teaserTexts: [DEFAULT_LAUNCHER_TEASER],
  avatarUrl: null,
};

const PRESET_PATHS: Set<string> = new Set(
  LAUNCHER_AVATAR_PRESETS.map((preset) => preset.path),
);

/** Absolute URL for the avatar shown on the client site. */
export function resolveLauncherAvatarUrl(
  launcher: ChatbotLauncherConfig,
  appOrigin: string,
): string {
  const origin = appOrigin.replace(/\/$/, "");
  const custom = launcher.avatarUrl?.trim();
  if (custom) {
    if (custom.startsWith("http://") || custom.startsWith("https://")) {
      return custom;
    }
    if (custom.startsWith("/")) {
      return `${origin}${custom}`;
    }
    return custom;
  }
  return `${origin}${DEFAULT_LAUNCHER_AVATAR_PATH}`;
}

/** Path used in the dashboard preview (relative to the app origin). */
export function resolveLauncherAvatarPath(
  avatarUrl: string | null | undefined,
): string {
  const custom = avatarUrl?.trim();
  if (!custom) return DEFAULT_LAUNCHER_AVATAR_PATH;
  if (custom.startsWith("http://") || custom.startsWith("https://")) {
    return custom;
  }
  if (custom.startsWith("data:image/")) return custom;
  if (custom.startsWith("/")) return custom;
  return DEFAULT_LAUNCHER_AVATAR_PATH;
}

/** Image formats accepted for a custom launcher photo. */
export const LAUNCHER_AVATAR_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
];

/** `accept` attribute for the file input. */
export const LAUNCHER_AVATAR_ACCEPT = LAUNCHER_AVATAR_ACCEPTED_TYPES.join(",");

/** Max size of the uploaded file before processing (8 MB). */
export const LAUNCHER_AVATAR_MAX_BYTES = 8 * 1024 * 1024;

/** Side of the square avatar we store (crisp on retina, still compact). */
export const LAUNCHER_AVATAR_OUTPUT_SIZE = 192;

/** True when the stored avatar is an uploaded photo (data URL). */
export function isCustomLauncherPhoto(avatarUrl: string | null | undefined): boolean {
  const value = avatarUrl?.trim();
  return Boolean(value && value.startsWith("data:image/"));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
    img.src = src;
  });
}

/**
 * Validates and normalizes an uploaded image into a compact, center-cropped
 * square data URL that fills the launcher circle. Runs in the browser only.
 */
export async function fileToLauncherAvatar(file: File): Promise<string> {
  if (!LAUNCHER_AVATAR_ACCEPTED_TYPES.includes(file.type)) {
    throw new Error("Formato não suportado. Use PNG, JPEG, WEBP, GIF ou AVIF.");
  }
  if (file.size > LAUNCHER_AVATAR_MAX_BYTES) {
    throw new Error("Imagem muito grande. Envie um arquivo de até 8 MB.");
  }

  const sourceDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(sourceDataUrl);
  const size = LAUNCHER_AVATAR_OUTPUT_SIZE;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sourceDataUrl;

  // Center-crop to a square ("cover") so the photo fills the circle with no
  // distortion or empty space, then downscale to the target size.
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  // Prefer WEBP (smaller); fall back to JPEG when unsupported.
  const webp = canvas.toDataURL("image/webp", 0.85);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Which built-in preset is selected, if any. */
export function matchLauncherAvatarPreset(
  avatarUrl: string | null | undefined,
): LauncherAvatarPresetId | null {
  const path = resolveLauncherAvatarPath(avatarUrl);
  const preset = LAUNCHER_AVATAR_PRESETS.find((entry) => entry.path === path);
  return preset?.id ?? null;
}

/** True when the stored URL is one of the built-in cartoon robots. */
export function isLauncherAvatarPreset(avatarUrl: string | null): boolean {
  if (!avatarUrl) return true;
  return PRESET_PATHS.has(avatarUrl.trim());
}

/** Trims, drops empties, dedupes; falls back to the default teaser. */
export function normalizeLauncherTeaserTexts(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [DEFAULT_LAUNCHER_TEASER];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out.length > 0 ? out : [DEFAULT_LAUNCHER_TEASER];
}

/** Parses launcher from stored JSON; always returns a complete config. */
export function normalizeLauncher(raw: unknown): ChatbotLauncherConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_LAUNCHER, teaserTexts: [...DEFAULT_LAUNCHER.teaserTexts] };
  }
  const record = raw as Record<string, unknown>;
  const avatarRaw = record.avatarUrl;
  let avatarUrl: string | null = null;
  if (typeof avatarRaw === "string" && avatarRaw.trim()) {
    const trimmed = avatarRaw.trim();
    // Migrate old photorealistic default to the cartoon robot.
    if (
      trimmed.endsWith("/embed/default-avatar.png") ||
      trimmed === "/embed/default-avatar.png" ||
      trimmed === "/embed/robot-helper.png"
    ) {
      avatarUrl = null;
    } else if (trimmed === "/embed/robot-helper-feminine.png") {
      avatarUrl = "/embed/robot-helper-feminine.webp";
    } else {
      avatarUrl = trimmed;
    }
  }
  return {
    teaserTexts: normalizeLauncherTeaserTexts(record.teaserTexts),
    avatarUrl,
  };
}

/** Builds launcher config from form fields. */
export function buildLauncherFromInput(input: {
  launcherTeaserTexts: string[];
  launcherAvatarUrl: string | null;
}): ChatbotLauncherConfig {
  const raw =
    typeof input.launcherAvatarUrl === "string" &&
    input.launcherAvatarUrl.trim()
      ? input.launcherAvatarUrl.trim()
      : null;
  // Persist null for the default robot so configs stay compact.
  const avatarUrl =
    raw === null || raw === DEFAULT_LAUNCHER_AVATAR_PATH ? null : raw;
  return {
    teaserTexts: normalizeLauncherTeaserTexts(input.launcherTeaserTexts),
    avatarUrl,
  };
}
