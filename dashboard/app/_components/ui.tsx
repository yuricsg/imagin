import type { ReactNode } from "react";
import { initials } from "@/lib/format";

export function Badge({
  label,
  className,
  dot,
}: {
  label: string;
  className: string;
  dot?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {dot ? <span className={`size-1.5 rounded-full ${dot}`} /> : null}
      {label}
    </span>
  );
}

export function Avatar({
  name,
  className,
  size = "md",
  imageSrc,
}: {
  name: string;
  className: string;
  size?: "sm" | "md";
  /** When set, shows the photo/illustration instead of initials. */
  imageSrc?: string | null;
}) {
  const sizing = size === "sm" ? "size-7 text-[11px]" : "size-9 text-xs";
  if (imageSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
        alt=""
        className={`inline-flex shrink-0 rounded-lg object-cover ${sizing}`}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-semibold ${sizing} ${className}`}
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200/70 dark:bg-zinc-800/80 dark:text-zinc-400 dark:ring-zinc-700/60">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </p>
        <p className="mx-auto max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
