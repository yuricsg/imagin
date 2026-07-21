"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { fetchPinnedCommands, savePinnedCommands } from "@/lib/api/pins";

const EMPTY_IDS: readonly string[] = [];
const cacheSnapshots = new Map<string, { raw: string | null; ids: string[] }>();
const cacheListeners = new Map<string, Set<() => void>>();

/** Per-user localStorage cache — an optimistic mirror, not the source of truth. */
function cacheKey(email: string): string {
  return `imagin:pinned-commands:${email.toLowerCase()}`;
}

function readCache(email: string): readonly string[] {
  if (typeof window === "undefined") return EMPTY_IDS;
  try {
    const raw = window.localStorage.getItem(cacheKey(email));
    const current = cacheSnapshots.get(email);
    if (current?.raw === raw) return current.ids;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const ids = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
    cacheSnapshots.set(email, { raw, ids });
    return ids;
  } catch {
    return EMPTY_IDS;
  }
}

function writeCache(email: string, ids: readonly string[]): void {
  if (typeof window === "undefined") return;
  try {
    const next = [...ids];
    const raw = JSON.stringify(next);
    window.localStorage.setItem(cacheKey(email), raw);
    cacheSnapshots.set(email, { raw, ids: next });
    cacheListeners.get(email)?.forEach((listener) => listener());
  } catch {
    // Storage unavailable (private mode / quota) — degrade quietly.
  }
}

function subscribeCache(email: string, listener: () => void): () => void {
  const listeners = cacheListeners.get(email) ?? new Set<() => void>();
  listeners.add(listener);
  cacheListeners.set(email, listeners);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== cacheKey(email)) return;
    cacheSnapshots.delete(email);
    listener();
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) cacheListeners.delete(email);
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * Command-palette pins for the signed-in operator. The database is the source
 * of truth (synced across devices); localStorage is only a same-device cache so
 * the pins render instantly before the network responds. Starts EMPTY on the
 * server and first client render (no hydration mismatch), then hydrates.
 */
export function usePinnedCommands(email: string | null): {
  /** Pinned command ids, oldest pin first (new pins append). */
  pinnedIds: readonly string[];
  togglePin: (id: string) => void;
} {
  // Guards a stale network response from overwriting a newer local toggle.
  const versionRef = useRef(0);

  const subscribe = useCallback(
    (listener: () => void) =>
      email ? subscribeCache(email, listener) : () => undefined,
    [email],
  );
  const getSnapshot = useCallback(
    () => (email ? readCache(email) : EMPTY_IDS),
    [email],
  );
  const pinnedIds = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => EMPTY_IDS,
  );

  useEffect(() => {
    if (!email) return;
    const version = (versionRef.current += 1);
    let cancelled = false;
    fetchPinnedCommands(email)
      .then((ids) => {
        if (cancelled || version !== versionRef.current) return;
        writeCache(email, ids);
      })
      .catch(() => {
        // Offline / backend cold — keep showing the cached pins.
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  const togglePin = useCallback(
    (id: string) => {
      if (!email) return;
      versionRef.current += 1;
      const current = readCache(email);
      const next = current.includes(id)
        ? current.filter((pinned) => pinned !== id)
        : [...current, id];
      writeCache(email, next);
      // Optimistic: persist in the background; the cache keeps the UI honest
      // if the write fails, and the next load reconciles.
      void savePinnedCommands(email, next).catch(() => {});
    },
    [email],
  );

  return { pinnedIds, togglePin };
}
