"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_LAUNCHER_TEASER,
  resolveLauncherAvatarPath,
} from "@/lib/chatbots/launcher";

const ROTATION_MS = 4500;

/**
 * Live preview of the site launcher (speech bubble + avatar).
 * Mirrors the visual language of `public/embed/widget.js`.
 */
export function LauncherPreview({
  teaserTexts,
  avatarUrl,
}: {
  teaserTexts: string[];
  avatarUrl: string | null;
}) {
  const lines = teaserTexts.map((t) => t.trim()).filter(Boolean);
  const texts = lines.length > 0 ? lines : [DEFAULT_LAUNCHER_TEASER];
  const [index, setIndex] = useState(0);
  const textKey = texts.join("\n");

  useEffect(() => {
    if (texts.length < 2) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % texts.length);
    }, ROTATION_MS);
    return () => window.clearInterval(id);
  }, [texts.length, textKey]);

  const src = resolveLauncherAvatarPath(avatarUrl);
  const current = texts[index % texts.length] ?? texts[0];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Prévia no site
        </span>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
          Como o visitante vê o balão
        </span>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-100 px-5 py-10 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="relative flex items-end justify-end gap-2.5">
          <div className="relative max-w-[min(280px,70%)] rounded-2xl bg-white px-3.5 py-3 text-left shadow-lg shadow-zinc-900/10 dark:bg-zinc-50">
            <p className="text-sm font-medium leading-snug text-zinc-900">
              {current}
            </p>
            <span
              aria-hidden
              className="absolute -right-1.5 bottom-4 size-3 rotate-45 bg-white shadow-sm dark:bg-zinc-50"
            />
          </div>
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              width={56}
              height={56}
              className="size-14 rounded-full border-2 border-white object-cover shadow-md shadow-zinc-900/15"
            />
            <span
              aria-hidden
              className="absolute bottom-0.5 right-0.5 size-3 rounded-full border-2 border-white bg-emerald-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
