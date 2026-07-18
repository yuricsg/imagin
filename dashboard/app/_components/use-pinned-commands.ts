"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPinnedCommands, savePinnedCommands } from "@/lib/api/pins";

/** Per-user localStorage cache — an optimistic mirror, not the source of truth. */
function cacheKey(email: string): string {
  return `imagin:pinned-commands:${email.toLowerCase()}`;
}

function readCache(email: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(cacheKey(email));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeCache(email: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey(email), JSON.stringify(ids));
  } catch {
    // Storage unavailable (private mode / quota) — degrade quietly.
  }
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
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  // Guards a stale network response from overwriting a newer local toggle.
  const versionRef = useRef(0);

  useEffect(() => {
    if (!email) {
      setPinnedIds([]);
      return;
    }
    const version = (versionRef.current += 1);
    // Instant paint from cache, then reconcile with the authoritative DB copy.
    setPinnedIds(readCache(email));
    let cancelled = false;
    fetchPinnedCommands(email)
      .then((ids) => {
        if (cancelled || version !== versionRef.current) return;
        setPinnedIds(ids);
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
      setPinnedIds((current) => {
        const next = current.includes(id)
          ? current.filter((pinned) => pinned !== id)
          : [...current, id];
        writeCache(email, next);
        // Optimistic: persist in the background; the cache keeps the UI honest
        // if the write fails, and the next load reconciles.
        void savePinnedCommands(email, next).catch(() => {});
        return next;
      });
    },
    [email],
  );

  return { pinnedIds, togglePin };
}
