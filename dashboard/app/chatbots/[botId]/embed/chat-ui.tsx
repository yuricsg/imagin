import type { ReactNode } from "react";

/**
 * Visual language shared by the embedded chat surfaces (embedded-chatbot.tsx
 * and custom-dialogue-chat.tsx). Runs on client sites, inside the iframe —
 * keep it self-contained (no dark-mode coupling to the dashboard theme).
 *
 * Brand: teal-600 `#0d9488` (matches the dashboard's `btn-brand`).
 * WhatsApp green `#25d366` is Meta's brand color — do not change.
 */
export const CHAT_SHELL =
  "flex min-h-dvh flex-col bg-white font-sans text-zinc-900";

export const CHAT_INPUT =
  "min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/15";

export const CHAT_PRIMARY_BUTTON =
  "rounded-xl bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-40";

export const CHAT_PRIMARY_BUTTON_BLOCK =
  "w-full rounded-xl bg-[#0d9488] py-3 text-sm font-semibold text-white transition hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-40";

export const CHAT_CHECKBOX_ON = "border-[#0d9488] bg-teal-50 text-[#0f766e]";
export const CHAT_CHECKBOX_OFF =
  "border-zinc-300 bg-white hover:border-[#0d9488]/40";
export const CHAT_ACCENT = "accent-[#0d9488]";

export const CHAT_STATUS_TEXT = "text-center text-xs text-zinc-500";

export const CHAT_ERROR =
  "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700";

export const CHAT_NOTE =
  "rounded-xl bg-zinc-100 px-3 py-2 text-xs leading-5 text-zinc-600";

export const WHATSAPP_BUTTON =
  "flex items-center justify-center gap-2 rounded-xl bg-[#25d366] py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe5a]";

export function ChatHeader({
  name,
  subtitle,
}: {
  name: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-zinc-200 bg-[#0d9488] px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-base font-bold text-white">
        {name.charAt(0)}
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{name}</p>
        <p className="text-xs text-white/75">{subtitle}</p>
      </div>
    </div>
  );
}

export function BubbleBot({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-[10px] font-bold text-white">
        A
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-100 px-3 py-2 text-sm leading-6 text-zinc-800">
        {children}
      </div>
    </div>
  );
}

export function BubbleUser({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#0d9488] px-3 py-2 text-sm leading-6 text-white">
        {children}
      </div>
    </div>
  );
}

export function TypingDots() {
  return (
    <div className="flex items-end gap-2" aria-label="Assistente digitando">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-[10px] font-bold text-white">
        A
      </div>
      <div className="flex h-10 items-center gap-1.5 rounded-2xl rounded-bl-sm bg-zinc-100 px-3">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 opacity-40 motion-safe:animate-pulse" />
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 opacity-70 motion-safe:animate-pulse [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 motion-safe:animate-pulse [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export function ChatOption({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-left text-sm font-medium transition hover:border-[#0d9488] hover:bg-teal-50 hover:text-[#0f766e] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
