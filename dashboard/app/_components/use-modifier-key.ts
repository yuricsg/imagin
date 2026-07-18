"use client";

import { useSyncExternalStore } from "react";

const MAC_PATTERN = /mac|iphone|ipad|ipod/i;

function getModifierLabel(): "⌘K" | "Ctrl+K" {
  if (typeof navigator === "undefined") return "⌘K";
  const platform = navigator.platform || navigator.userAgent;
  return MAC_PATTERN.test(platform) ? "⌘K" : "Ctrl+K";
}

function getServerSnapshot(): "⌘K" {
  return "⌘K";
}

// Platform never changes during a session, so no subscription is needed.
function subscribe(): () => void {
  return () => {};
}

/**
 * Keyboard shortcut hint per platform: "⌘K" on Apple devices, "Ctrl+K"
 * elsewhere. SSR-safe (defaults to "⌘K") and hydration-mismatch-free.
 */
export function useModifierKey(): "⌘K" | "Ctrl+K" {
  return useSyncExternalStore(subscribe, getModifierLabel, getServerSnapshot);
}
