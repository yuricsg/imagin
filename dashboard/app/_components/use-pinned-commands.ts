"use client";

import { useCallback, useSyncExternalStore } from "react";

/** localStorage key holding pinned palette command ids, in pin order. */
const STORAGE_KEY = "imagin:pinned-commands";

const EMPTY: string[] = [];
let cache: { raw: string | null; ids: string[] } = { raw: null, ids: EMPTY };
const listeners = new Set<() => void>();

function parsePinned(raw: string | null): string[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === "string");
    }
  } catch {
    // Corrupted payload — fall through to EMPTY.
  }
  return EMPTY;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getPinned(): string[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cache.raw) return cache.ids;
  const ids = parsePinned(raw);
  cache = { raw, ids };
  return ids;
}

function getServerPinned(): string[] {
  return EMPTY;
}

function savePinned(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage may be unavailable (private mode / quota) — degrade quietly.
  }
  for (const callback of listeners) callback();
}

/**
 * Pinned palette commands as an external store (same pattern as createdBots):
 * SSR and the first client render both see EMPTY, then the real value swaps
 * in — no hydration mismatch, no setState-in-effect. Ids that no longer match
 * a command are ignored at render time (they simply never show).
 */
export function usePinnedCommands(): {
  /** Pinned command ids, oldest pin first (new pins append). */
  pinnedIds: readonly string[];
  togglePin: (id: string) => void;
} {
  const pinnedIds = useSyncExternalStore(subscribe, getPinned, getServerPinned);
  const togglePin = useCallback((id: string) => {
    const current = getPinned();
    savePinned(
      current.includes(id)
        ? current.filter((pinned) => pinned !== id)
        : [...current, id],
    );
  }, []);
  return { pinnedIds, togglePin };
}
