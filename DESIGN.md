---
name: Imagin Dashboard
description: Painel operacional da agência para chatbots de captação e leads
colors:
  surface: "#fafafa"
  surface-elevated: "#ffffff"
  ink: "#18181b"
  ink-muted: "#71717a"
  ink-subtle: "#a1a1aa"
  border: "#e4e4e7"
  primary: "#6366f1"
  primary-deep: "#4f46e5"
  accent-violet: "#7c3aed"
  error: "#e11d48"
  error-soft: "#fff1f2"
typography:
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  control: "8px"
  panel: "12px"
  dialog: "16px"
spacing:
  control-y: "8px"
  control-x: "12px"
  section: "16px"
  panel: "20px"
components:
  button-primary:
    backgroundColor: "linear-gradient(to right, {colors.primary}, {colors.accent-violet})"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  panel:
    backgroundColor: "{colors.surface-elevated}"
    rounded: "{rounded.panel}"
---

## Overview

**The Operations Console** — a restrained product UI for agency operators managing capture chatbots and leads. Geist sans for all UI text; Geist Mono for embed URLs and technical snippets. Ambient indigo/violet radial wash on the page background (fixed, subtle). Surfaces use white/zinc at ~80% opacity with backdrop blur and hairline borders (`border-zinc-200/70`). Dark mode follows OS `prefers-color-scheme`.

Mood: calm, dense, trustworthy. Not a marketing site.

## Colors

| Role | Light | Usage |
|------|-------|--------|
| Surface | `zinc-50` body, `white/80` panels | Page and cards |
| Ink | `zinc-900` headings, `zinc-700` body | Primary text |
| Muted | `zinc-500`–`zinc-400` | Secondary labels, hints |
| Primary | `indigo-500` → `violet-600` gradient | Primary actions, brand mark |
| Accent palette | indigo, violet, sky, emerald, amber, rose | Per-chatbot identity (`lib/chatbots/accents.ts`) |
| Error | `rose-500` border, `rose-600` text | Validation |

Accent color is for identity dots, selected rows, and primary CTAs — not decorative fills on inactive UI.

## Typography

- **One family (Geist)** for all product UI; no display/body pairing.
- Scale: `text-lg` page title, `text-sm` body, `text-xs` labels and metadata, `text-[11px]` micro copy.
- **Mono** (`font-mono`, Geist Mono) for embed URLs, script paths, derived bot ids.
- Line length: prose hints max ~40ch; tables and toolbars may run wider.

## Elevation

Flat-to-layered: tonal surfaces + `border-zinc-200/70` + optional `shadow-sm` on primary buttons. Selected chatbot rows use accent-tinted surface + colored glow (`ACCENTS[].glow`). Dialogs: `shadow-2xl`, `backdrop-blur-xl`, scrim `zinc-950/40`.

No heavy drop shadows on static panels.

## Components

- **Primary button**: `rounded-lg bg-linear-to-r from-indigo-500 to-violet-600`, white semibold text, `shadow-sm shadow-indigo-500/30`, hover deepens gradient, disabled at 50% opacity.
- **Secondary button**: zinc text, hover `bg-zinc-100` (dark: `bg-zinc-800`).
- **Input / select**: `rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-sm`, focus `ring-2 ring-indigo-500/25`, error state rose border/ring.
- **Badge**: `rounded-full px-2 py-0.5 text-xs ring-1 ring-inset`.
- **Avatar**: `rounded-lg` initials chip with accent gradient fill.
- **Empty state**: centered icon in zinc gradient tile + title + description.
- **Modal**: bottom sheet on mobile (`rounded-t-2xl`), centered dialog on `sm+` (`max-w-lg`, `rounded-2xl`).

## Do's and Don'ts

**Do**
- Reuse zinc/indigo vocabulary from existing components (`leads-toolbar`, `chatbot-list`, `app-header`).
- Keep forms short upfront; tuck embed config behind disclosure.
- Show derived `id:` hint as user types the bot name.
- Use `aria-invalid`, `aria-describedby`, and visible focus rings.

**Don't**
- Add purple gradient hero sections or glass cards unrelated to the system.
- Use decorative motion (bounce, scale on every hover) in product flows.
- Expose all embed fields by default.
- Hard-code one-off colors outside Tailwind zinc/indigo/accent tokens.
