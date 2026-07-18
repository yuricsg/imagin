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
  primary: "#0d9488"
  primary-deep: "#0f766e"
  accent-violet: "#7c3aed"
  accent-indigo-soft: "#e0e7ff"
  status-online: "#10b981"
  status-online-ring: "rgba(16, 185, 129, 0.25)"
  ink-shadow: "rgba(24, 24, 27, 0.18)"
  ink-shadow-soft: "rgba(24, 24, 27, 0.06)"
  ink-shadow-strong: "rgba(24, 24, 27, 0.2)"
  ink-shadow-panel: "rgba(24, 24, 27, 0.28)"
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
  widget:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  control: "8px"
  panel: "12px"
  dialog: "16px"
  full: "999px"
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
  site-launcher:
    bubbleBackground: "{colors.surface-elevated}"
    bubbleText: "{colors.ink}"
    avatarBackground: "{colors.accent-indigo-soft}"
    onlineDot: "{colors.status-online}"
    rounded: "{rounded.dialog}"
    avatarRounded: "{rounded.full}"
---

## Overview

**The Operations Console** — a restrained product UI for agency operators managing capture chatbots and leads. Geist sans for all UI text; Geist Mono for embed URLs and technical snippets. The brand color is the **Imagin teal** sampled from the agency logo (`imagin-logo.png`): ambient teal radial wash on the page background (fixed, subtle). Surfaces are solid white panels (`bg-white`, dark `zinc-900/70`) with hairline borders (`border-zinc-200/80`); backdrop blur is reserved for the sticky header, sticky form footers, and modal scrims — never for static panels. Dark mode follows OS `prefers-color-scheme`.

Mood: calm, dense, trustworthy. Not a marketing site.

## Colors

| Role | Light | Usage |
|------|-------|--------|
| Surface | `zinc-50` body, `white` panels (dark `zinc-900/70`) | Page and cards |
| Ink | `zinc-900` headings, `zinc-700` body | Primary text |
| Muted | `zinc-500`–`zinc-400` | Secondary labels, hints |
| Primary | **Imagin teal** `teal-600` (#0d9488, hover `teal-700` #0f766e) | Primary actions, selection, focus rings — solid, never gradient |
| Accent palette | indigo, violet, sky, emerald, amber, rose | Per-chatbot identity (`lib/chatbots/accents.ts`) — solid/tonal fills |
| Site launcher | white bubble, ink text, indigo-soft avatar fallback, emerald online dot | Embed widget on client sites (`public/embed/widget.js`) |
| Error | `rose-500` border, `rose-600` text | Validation |

**Teal is brand/action, not status.** Teal marks interactive affordances (CTAs, selected states, focus rings, brand tiles). Status positive (online dot, converted badge, success banners) stays `emerald/green`; validation stays `rose`. Never use teal for status semantics and never emerald for primary actions — the two greens must not collide.

Accent color is for identity dots, selected rows, and primary CTAs — not decorative fills on inactive UI. The violet of the logo glyph survives only inside the per-bot accent palette; chrome never uses indigo/violet.

## Typography

- **One family (Geist)** for all product UI; no display/body pairing.
- Scale: `text-lg` page title, `text-sm` body, `text-xs` labels and metadata, `text-[11px]` micro copy.
- **Mono** (`font-mono`, Geist Mono) for embed URLs, script paths, derived bot ids.
- Line length: prose hints max ~40ch; tables and toolbars may run wider.

## Elevation

Flat-to-layered: solid tonal surfaces + `border-zinc-200/80` + optional `shadow-sm` on primary buttons. Selected chatbot rows use accent-tinted surface + colored glow (`ACCENTS[].glow`). Dialogs: `shadow-2xl`, scrim `zinc-950/40` with `backdrop-blur-sm`. Sticky chrome (header, wizard footers) keeps a light `backdrop-blur-sm` over `white/95`.

No heavy drop shadows on static panels.

## Components

- **Primary button**: `rounded-lg bg-teal-600` sólido, white semibold text, `shadow-sm shadow-teal-600/30`, hover `bg-teal-700`, disabled at 50% opacity. Nunca gradiente.
- **Secondary button**: zinc text, hover `bg-zinc-100` (dark: `bg-zinc-800`).
- **Input / select**: `rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm`, focus `ring-2 ring-teal-500/25`, error state rose border/ring.
- **Badge**: `rounded-full px-2 py-0.5 text-xs ring-1 ring-inset`.
- **Avatar**: `rounded-lg` initials chip with accent gradient fill.
- **Empty state**: centered icon in zinc gradient tile + title + description.
- **Modal**: bottom sheet on mobile (`rounded-t-2xl`), centered dialog on `sm+` (`max-w-lg`, `rounded-2xl`).
- **Site launcher** (`public/embed/widget.js`): speech bubble + circular avatar + online status; Arial stack (host-site isolation); `rounded.dialog` bubble, `rounded.full` avatar; colors from `components.site-launcher`.

## Motion

Motion is a token system, never ad-hoc. All keyframes/classes live in `app/globals.css` (prefix `imagin-` / `.motion-*`); never hand-write per-component keyframes.

**Tokens** (`:root` in `globals.css`)

| Token | Value | Uso |
|-------|-------|-----|
| `--motion-ease-out` | `cubic-bezier(0.2, 0.7, 0.3, 1)` | Easing padrão de entradas |
| `--motion-duration-fast` | `150ms` | Hover/press feedback |
| `--motion-duration-enter` | `180ms` | Entradas (fade + subida 5px) |
| `--motion-duration-shimmer` | `1.5s` | Varredura do skeleton |
| `--motion-stagger-step` | `35ms` | Intervalo entre itens de lista |

**Padrões**

- **Skeleton shimmer** (`.motion-skeleton`): blocos zinc com varredura de 1.5s. Use o componente `Skeleton` (`_components/ui.tsx`) e os espelhos `MetricsRowSkeleton` / `LeadsTableSkeleton` / `ChatbotListSkeleton`. Como os dados chegam 100% via servidor, os skeletons granulares são consumidos por `app/loading.tsx` — nunca um spinner solto para loading de conteúdo.
- **Entradas** (`.motion-enter`): fade + subida de 5px em 180ms, `both`. Listas somam `style={{ animationDelay }}` com stagger de 35ms e cap de ~10 itens (`Math.min(index, 9) * 35`).
- **Replay de stagger**: só em filtros discretos (bot, cliente, status, datas) via `key={filterSignature}` na tabela. A busca por texto fica fora da assinatura para não re-animar a cada tecla.
- **Hover lift** (`.motion-lift`): `translateY(-1px)` + sombra sutil, só em cards e linhas clicáveis. Não aplicar em `<tr>` de tabela com `border-collapse` (transform/sombra quebram o colapso de bordas) — linhas de tabela usam apenas enter + stagger.
- **Press** (`.motion-press`): `:active { scale(.98) }` em botões e itens clicáveis.
- **Pulse de atividade** (`.motion-pulse`): anel azul suave em 2.4s, reservado a badges de atividade nova ("N novos").
- **Spinner inline** (`IconSpinner` + `animate-spin`): somente dentro de botão de ação async (ex.: "Salvando…" no wizard), nunca solto na página. Sucesso = o check da tela de sucesso.
- **Contadores de métricas**: valor com `key={value}` + `.motion-enter` — troca de filtro re-anima o número suavemente.
- **`prefers-reduced-motion`**: media query global em `globals.css` zera todas as animations/transitions (0.01ms) — o conteúdo sempre aparece completo e instantâneo.
- **RobotLoader** (`_components/robot-loader.tsx`, herói do `app/loading.tsx`): mascote com bob+tilt (`imagin-robot-bob` 1.8s), barra indeterminada teal (`imagin-progress-slide`, fill 40% deslizante, `role="progressbar"` sem valor), reticências pulsantes e 4 frases rotativas em loop de 10s (CSS puro, delays 0/2.5/5/7.5s). Server component, zero JS. Em reduced-motion: robô estático, barra fixa em 60%, frase única "Carregando…".

## Comandos e atalhos

Console de operador usa teclado de primeira classe (estilo Linear).

- **Command palette** (`_components/command-palette.tsx`): overlay `role="dialog"` com input `role="combobox"` + lista `role="listbox"`, `aria-activedescendant`, ↑/↓/Enter/Esc, backdrop fecha, foco devolvido ao gatilho. Abre com **⌘K / Ctrl+K** (funciona mesmo dentro de inputs) ou pelo botão "⌘K" no header (evento `imagin:toggle-command-palette`; fora da home o botão vira link para "/"). O hint do atalho é por plataforma (`use-modifier-key.ts`): "⌘K" no SSR e em Apple, "Ctrl+K" em Windows/Linux após o mount — aplicado no `<kbd>`/title do botão e no footer da palette, sem hydration mismatch. Ações: criar chatbot, abrir cada bot, duplicar qualquer bot (inclusive o demo; Editar segue restrito a editáveis), copiar snippet do bot selecionado (com aviso "Copiado!"), alternar tema, "Somente novos", exportar CSV.
- **Atalhos globais da home**: `/` foca a busca de leads; `n` abre `/chatbots/new`; `Esc` fecha palette/modais. Teclas soltas nunca disparam com foco em input/textarea/select/contenteditable.
- **Quick actions de lead** (desktop, reveladas em hover/focus-within da linha): copiar mensagem do WhatsApp (feedback "Copiado") e abrir conversa no WhatsApp. No mobile o card segue alvo único; o modal de detalhes oferece o link "Abrir conversa no WhatsApp".
- **Chip "Somente novos"** na toolbar: `aria-pressed`, contador ao vivo, combina com os demais filtros.
- **Menu de ações do chatbot** (kebab "⋯", visível em todo bot): padrão WAI-ARIA menu button — abre com clique/Enter/Espaço/↓, ↑↓ movem foco real, Esc fecha e devolve foco ao gatilho, clique fora fecha, um menu aberto por vez. Todo bot tem **Duplicar**; **Editar** e **Excluir** só aparecem em bots editáveis (o demo mostra apenas "Duplicar", sem separador). Excluir é rose, com diálogo de confirmação. Dropdown entra com `.motion-menu` (fade + subida 4px, 150ms). Ações nunca ficam escondidas atrás de hover.

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
