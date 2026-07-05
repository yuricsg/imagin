/** Optional per-bot tracking IDs injected into the embed widget. */

export interface ChatbotTrackingConfig {
  /** GA4 measurement ID, e.g. G-XXXXXXXXXX. Empty = disabled. */
  gaMeasurementId: string;
  /** Meta (Facebook) Pixel ID. Empty = disabled. */
  metaPixelId: string;
}

export const EMPTY_TRACKING: ChatbotTrackingConfig = {
  gaMeasurementId: "",
  metaPixelId: "",
};

/** GA4: G-XXXXXXXX. Also accepts legacy UA-XXXX-Y for older setups. */
export function isValidGaMeasurementId(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^G-[A-Z0-9]+$/i.test(trimmed) || /^UA-\d+-\d+$/.test(trimmed);
}

/** Meta Pixel IDs are numeric, typically 15–16 digits. */
export function isValidMetaPixelId(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^\d{10,20}$/.test(trimmed);
}

export function buildTrackingFromInput(input: {
  gaMeasurementId: string;
  metaPixelId: string;
}): ChatbotTrackingConfig {
  return {
    gaMeasurementId: input.gaMeasurementId.trim(),
    metaPixelId: input.metaPixelId.trim(),
  };
}

export function hasTrackingConfigured(tracking: ChatbotTrackingConfig): boolean {
  return Boolean(tracking.gaMeasurementId || tracking.metaPixelId);
}
