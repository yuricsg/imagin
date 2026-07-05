import { describe, expect, it } from "vitest";
import {
  isValidGaMeasurementId,
  isValidMetaPixelId,
} from "./tracking";

describe("tracking validation", () => {
  it("accepts empty GA and Meta IDs", () => {
    expect(isValidGaMeasurementId("")).toBe(true);
    expect(isValidMetaPixelId("")).toBe(true);
  });

  it("validates GA4 and legacy UA formats", () => {
    expect(isValidGaMeasurementId("G-ABC123XYZ")).toBe(true);
    expect(isValidGaMeasurementId("UA-123456-1")).toBe(true);
    expect(isValidGaMeasurementId("invalid")).toBe(false);
  });

  it("validates Meta Pixel numeric IDs", () => {
    expect(isValidMetaPixelId("123456789012345")).toBe(true);
    expect(isValidMetaPixelId("abc")).toBe(false);
    expect(isValidMetaPixelId("123")).toBe(false);
  });
});
