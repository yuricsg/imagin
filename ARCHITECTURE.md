# Imagin Architecture

## Current State

The repository currently contains a Next.js dashboard in `dashboard/` and a Hono API in `backend/`.

- Dashboard framework: Next.js App Router.
- Dashboard UI: React 19 and Tailwind CSS 4.
- Backend framework: Hono on Node.js.
- Runtime API surface: Hono routes under `backend/src/app.ts`.
- Dashboard: lead overview implemented on `/`.
- Widget: static loader implemented at `/embed/widget.js`.
- Chatbot iframe: implemented at `/chatbots/[botId]/embed`.
- Chatbot registry: static defaults in `backend/src/chatbots/catalog.ts` plus custom bots created through the dashboard.
- Persistence: Prisma/Postgres for runtime repositories, with local JSON repositories retained for focused tests and fallback development.
- Conversation analytics: `chat_sessions` records one access when the lazy iframe opens; `chat_events` records name, intent, answers, completion, WhatsApp click, and confirmed conversion.
- Attribution: widget captures UTM parameters, click IDs, referrer, page URL, landing page URL, `_fbp`, `_fbc`, and GA client ID from `_ga`.
- Tracking dispatch: backend can send Meta Conversions API and GA4 Measurement Protocol events after lead creation.
- Authentication: not configured.
- Multi-client model: `botId` and `clientId` are accepted, stored, listed, and filterable, but there is no authenticated organization/client model yet.
- Dashboard reporting: top metrics, lead list, and CSV share the selected chatbot/client/date context. Lead details open in an accessible modal.
- Real-data rule: dashboard lead loading has no mock fallback. API failure produces an explicit error and an empty list.

The current MVP proves the embed-to-dashboard lead path with a production database. Authentication remains future work. A dialogue builder for new bots is available in the dedicated create/edit wizard pages (`/chatbots/new`, `/chatbots/[botId]/edit`); legacy bots keep their existing runtime.

## Product Goal

Build embeddable lead-capture chatbots for client websites. Each chatbot should collect structured lead information, create a dashboard-visible lead record, and optionally hand the conversation off to WhatsApp with a prefilled message.

The first chatbot flow is for Dra. Renata Reis and supports:

- Floating button copy variants for consultations, exams, echocardiogram, cardiology opinion, and laboratory exams.
- Name capture.
- Intent selection:
  - Schedule exam.
  - Schedule cardiology consultation.
  - Severe symptom evaluation, which should go directly to the secretary.
- Exam selection with multi-select.
- Medical request status.
- Consultation need selection.
- WhatsApp handoff message generation.

Dashboard-managed bots can choose one conversation flow:

- `cardiology_exam_consultation`: exams, cardiology consultation, and severe symptom triage.
- `exam_scheduling`: exam scheduling only.
- `consultation_scheduling`: consultation scheduling only.
- `urgent_triage`: urgent triage only.

## Automatic Lead Funnel

The widget creates a chat session only when the visitor opens the launcher and the lazy iframe mounts. An anonymous session counts as an access but is not returned as a lead. `name_captured` makes the session eligible for the lead list.

Lead status is derived automatically with this precedence:

1. `converted`: a trusted external system called the conversion webhook.
2. `not_interested`: the visitor explicitly chose a no-interest answer.
3. `appointment_requested`: an exam scheduling intent or explicit scheduling answer was recorded.
4. `whatsapp_handoff`: the visitor clicked the WhatsApp CTA without a stronger outcome.
5. `abandoned`: a named session has no stronger outcome and has been inactive for at least 30 minutes.
6. `new`: the named session is still active or awaiting a stronger event.

Opening a WhatsApp URL does not prove conversion. Conversion requires `POST /api/integrations/leads/:leadId/converted` with `Authorization: Bearer $CONVERSION_WEBHOOK_SECRET`. This endpoint is intended for an agenda, CRM, or WhatsApp automation that has confirmed the appointment.

## Database Migration And Compatibility

Migration `20260714120000_add_chat_sessions_and_lead_details` is additive and
keeps all existing lead rows intact:

- Existing `leads` rows receive nullable contact, answer, destination, and
  session-link columns. `flowMode` defaults to `legacy`, so older records keep
  their original interpretation.
- `chat_sessions` stores one access per opened iframe, current progress, source,
  and automatic-funnel timestamps. A unique optional `leadId` prevents one
  completed lead from being attached to multiple sessions.
- `chat_events` is the ordered audit trail for each session. Its foreign key
  uses `ON DELETE CASCADE`, so removing a session also removes its event history.
- `leads.sessionId` is optional and unique. Older leads remain valid without a
  session, while new chatbot submissions can be merged with their in-progress
  session without producing duplicate dashboard rows.
- Composite indexes support reporting by chatbot/client and opening date;
  timeline indexes support ordered event reads without scanning all events.

Production deploys run `prisma migrate deploy` before starting the API. The
repository's `npm run qa:live-db` check must pass after migration: it writes an
isolated `qa-live-*` session and lead, validates the complete database contract,
and removes the QA data even if an assertion fails.

### Custom dialogue builder (new bots)

New bots created on `/chatbots/new` (or edited on `/chatbots/[botId]/edit`) can define a `DialogueFlow` stored on `Chatbot.flow.dialogue`:

- `shape`: `linear` (fixed step order) or `branching` (each single-choice option may point to another step or end).
- `steps[]`: each step has `question`, `inputType` (`text` | `single_choice` | `multi_choice`), optional `options`, and optional `mapsTo` (`name` | `phone` | `email` | `message`).
- `greeting` / `startStepId`: opening message and first step after greeting.

**Runtime rule:** if `dashboardConfig.flow.dialogue` is present with `version: 1` and at least one step, the embed widget runs the generic dialogue interpreter. Bots without `dialogue` (including Dra. Renata Reis and older dashboard bots) keep the legacy intent-based cardiology state machine.

Custom-dialogue lead submissions send `flowMode: "custom_dialogue"` plus optional `answers`, `phone`, `email`, and `message`. Legacy intent validation is skipped for that mode.

**Labels vs option ids:** `answers` keeps raw option ids keyed by step id (branching logic depends on them). Everything human-readable is resolved back to option labels with `resolveAnswerLabels` (dashboard) / `resolveDialogueAnswers` (backend, reading `dashboardConfig.flow.dialogue`): the `customFields`/`message` values the widget sends, the WhatsApp message template variables (`{exame}`, `{solicitacao}`, `{mensagem}`, custom saveAs keys, etc.), and the answers shown in the dashboard lead modal. Multi-choice labels join with `", "`. An id the dialogue no longer knows falls back to the raw value — never an empty string.

**Two ways to end the flow:** in a branching dialogue, a single-choice option's `nextStepId` may be a step id, empty (end and hand off to WhatsApp — the builder labels it "Encerrar e direcionar ao WhatsApp"), or the sentinel `end:no-whatsapp` (`FLOW_END_NO_WHATSAPP`, builder label "Encerrar conversa (sem WhatsApp)"). The sentinel ends the chat with one tone-aware goodbye bubble (`farewellMessageForTone`) — no closing bubbles, no lead creation, no WhatsApp CTA. The runtime still records `answer_submitted` (so a no-interest label derives `not_interested` as usual) and `flow_completed` for the audit trail. In the legacy flow, a `consultationDecision` that reads as no-interest (`isNotInterestedDecision`, mirroring the backend's `isNotInterestedText`) still registers the lead but ends with the same goodbye instead of the WhatsApp CTA.

### Site launcher (bubble + avatar)

Dashboard bots store `Chatbot.launcher`:

- `teaserTexts: string[]` — rotating lines inside the speech bubble (required, at least one).
- `avatarUrl: string | null` — custom photo URL, uploaded data URL, or built-in preset path (`/embed/robot-helper.png`, `/embed/robot-helper-feminine.png`); `null` uses the friendly cartoon robot.

On create/update, the dashboard API mirrors `launcher.teaserTexts` into backend `buttonTexts` for compatibility. Public config (`GET /api/public/chatbots/:botId/config`) exposes `launcher` (from `dashboardConfig.launcher`, falling back to `buttonTexts`).

`flow.tone` (`friendly` | `formal`) rewrites stock dialogue copy when the operator toggles tone in the wizard: greeting, template prompts (service/insurance/etc.), contact-field questions, and the closing line. Operator-edited questions are left unchanged. Templates expose `greetingsByTone` / `promptsByTone`; `applyToneToDialogue(dialogue, tone, templateId)` applies the swap.

### Operational flow name (`flowName`)

A bot has two distinct names:

- `Chatbot.name` is **visitor-facing**: it goes into the embed snippet as
  `data-bot-name` and appears in the chat header on the client site.
- `Chatbot.flowName` (optional) is **operator-facing**: it titles the bot in
  the dashboard list and every other operator surface (selected-bot contexts,
  embed block, lead views, CSV export) via `chatbotDisplayName(bot)`, which
  falls back to `name` when `flowName` is empty. Several bots can share the
  same visitor-facing `name` while keeping distinct flow names.

`flowName` lives inside the `dashboardConfig` JSON column like every other
dashboard-only field, so no database migration is needed.
`normalizeStoredChatbot` preserves it only when it is a non-blank string, and
`buildChatbot` / `updateChatbot` store `undefined` for blank input, so older
payloads and untouched bots simply have no key. Nothing visitor-facing (widget,
embed script, iframe) reads it.

### Duplicating a bot

The bot list has a duplicate action (same visibility rules as edit/delete)
that navigates to `/chatbots/new?from=<botId>`. The creation wizard loads the
source bot with the same lookup pattern as the edit page (local store first,
`apiListChatbots` fallback, loading/not-found states) and pre-fills **every**
field — dialogue, WhatsApp, launcher, tracking, embed — through
`duplicateChatbotInput(bot)`, which is `chatbotToInput(bot)` with a
`" (cópia)"` suffix on both `name` and `flowName` (falling back to `name`).
The operator can change anything, including the client, before saving. Submit
stays in creation mode (`onCreate`), so `buildChatbot` derives a fresh
id/createdAt (with numeric suffix on id collision) and the source bot is never
modified.

## Recommended Embed Strategy

Use a small script loader on the client site that injects an iframe-hosted widget.

Example client install snippet (domains come from the bot's `embed` config —
`NEXT_PUBLIC_APP_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` on the dashboard,
falling back to the current production deploys, Vercel + Render):

```html
<script
  src="https://imagin-virid.vercel.app/embed/widget.js"
  data-api-base-url="https://imagin-v587.onrender.com"
  data-bot-id="dra-renata-reis"
  data-client-id="client_id"
></script>
```

`DEFAULT_EMBED` once pointed at aspirational `*.imagin.app` domains that were
never configured in DNS; bots saved with exactly those values are healed to
the current defaults when `normalizeStoredChatbot` reads them (custom values
are untouched), and the healed value persists on the next save.

The script should:

- Render the floating site launcher as a speech bubble + avatar (not a plain pill button).
- Rotate `launcher.teaserTexts` (or legacy `buttonTexts`) every few seconds while the panel is closed.
- Use `launcher.avatarUrl` when set; otherwise `/embed/robot-helper.png` from the app origin. Built-in presets also include `/embed/robot-helper-feminine.png`.
- Create an iframe only when the widget is opened, unless preloading is explicitly enabled.
- Pass only public configuration to the iframe.
- Use `postMessage` for parent/iframe resize, open, close, and analytics events.
- Avoid storing sensitive data on the client site.

The iframe should:

- Load from the Imagin domain.
- Run the actual chatbot UI.
- Render a persistent conversation timeline where every user choice becomes a user message.
- Show a short typing indicator before bot replies and before the next option set appears.
- Submit lead events directly to Imagin APIs.
- Open WhatsApp in a new tab only after explicit user action.

This approach is preferred over giving clients a raw iframe because the script keeps installation simple while the iframe isolates CSS, JavaScript, storage, and future UI changes. Shadow DOM can be revisited later for a lighter native-feeling widget, but iframe isolation is the safer default for many unrelated client websites.

## WhatsApp Handoff and Multi-Number Routing

A bot may hand off to more than one WhatsApp number — one per office, for a
doctor who sees patients in several states. The numbers live in the bot's
`dashboardConfig.whatsapp`:

- `destinations`: `{ id, label, phoneNumber }[]`, one entry per office. `label`
  is what the visitor picks; `phoneNumber` is digits-only with country code.
- `routingQuestion`: asked right before the handoff.
- `phoneNumber`: mirrors `destinations[0]`, kept so consumers that do not route
  (the legacy widget flow, the `bots.whatsappPhone` column) keep working.

With a single destination the flow is unchanged. With two or more, the widget
appends a routing step after the last dialogue question, sends the visitor's
pick as `whatsappDestinationId` on the lead payload, and also exposes the chosen
office to the message template as `{unidade}`.

The backend resolves the destination in `buildWhatsAppUrl` (`chatbots/catalog.ts`)
by looking the id up in `dashboardConfig.whatsapp.destinations`, falling back to
the bot's primary `whatsappPhone` when the id is absent or unknown. The resolved
link is what gets stored on `leads.whatsappUrl`. Destinations live inside the
existing `dashboardConfig` JSON column, so adding an office needs no migration.

Bots saved before routing existed carry only `whatsapp.phoneNumber`; the
dashboard migrates them into a single unnamed destination on read
(`normalizeWhatsAppDestinations`).

`whatsapp.closingMessage` is an optional operator-editable override for the
last chat bubble before the WhatsApp button — the directional line that tells
the visitor to actually send the pre-filled message. When absent or blank, both
widgets fall back to their tone-based defaults (friendly/formal); when set, the
custom text always wins and is never rewritten by later tone changes. It only
applies with `whatsapp.enabled` and persists inside the existing
`dashboardConfig` JSON, so no migration is needed.

## Suggested Routes

Use the Hono backend for APIs and the Next.js dashboard for the widget UI.

Public widget routes:

- `GET /embed/widget.js`: script loader served with long-lived caching and versioning.
- `GET /chatbots/[botId]/embed`: iframe UI route.
- `GET /api/public/chatbots/[botId]/config`: public-safe bot configuration on the Hono backend.
- `POST /api/public/chatbots/[botId]/leads`: creates lead records on the Hono backend.
- `POST /api/public/chatbots/[botId]/sessions`: records a chatbot access and returns an opaque session id.
- `POST /api/public/chatbots/[botId]/sessions/[sessionId]/events`: appends public conversation events.
- Optional tracking side effects from the lead endpoint:
  - Meta Conversions API `Lead` event.
  - GA4 Measurement Protocol `generate_lead` event.

Dashboard routes:

- `GET /`: lead overview.
- `GET /api/chatbots`: configured chatbot catalog on the Hono backend.
- `POST /api/chatbots`: creates a dashboard-managed chatbot with private tracking credentials stored server-side.
- `GET /api/leads`: returns access summaries and a lead list where named sessions are merged with completed leads without duplication.
- `GET /api/leads?botId=[botId]`: bot-scoped lead list.
- `GET /api/leads?clientId=[clientId]`: client-scoped lead list.

Planned routes:

- `GET /dashboard/chatbots`: chatbot list.
- `GET /dashboard/chatbots/[botId]`: flow/config editor.

## Suggested Data Model

Core entities:

- `organizations`
  - Owns clients, users, chatbots, and leads.
- `clients`
  - Represents a customer/site where a bot is installed.
- `chatbots`
  - Stores bot metadata, public slug, active status, `flowKey`, and the primary WhatsApp destination. Additional per-office destinations live in the `dashboardConfig` JSON.
- `chatbot_versions`
  - Stores versioned flow definitions so historic leads remain explainable after bot edits.
- `chat_sessions`
  - Tracks one visitor interaction from opening through the latest activity, including automatic-funnel timestamps.
- `chat_messages`
  - Stores normalized user and bot messages.
- `lead_submissions`
  - Stores structured lead fields and current lead status.
- `lead_events`
  - Implemented as `chat_events`; stores opened, name, intent, answers, completion, handoff, and conversion confirmation.
- `allowed_origins`
  - Defines which client domains can load each bot.

For the Dra. Renata Reis flow, the structured lead payload currently includes:

```json
{
  "name": "string",
  "intent": "schedule_exam | schedule_consultation | severe_symptoms",
  "selectedExams": ["string"],
  "medicalRequestStatus": "Sim | Não | Tenho dúvidas",
  "consultationNeed": "Avaliação pré-operatória | Acompanhamento cardiológico | Check-up | Sintomas: dor no peito, falta de ar, palpitações | Outro",
  "consultationDecision": "Quero agendar uma consulta | Tenho dúvidas | Não tenho interesse no momento",
  "source": {
    "pageUrl": "string",
    "landingPageUrl": "string",
    "referrer": "string",
    "parentOrigin": "string",
    "utm": {
      "source": "string",
      "medium": "string",
      "campaign": "string",
      "content": "string",
      "term": "string",
      "id": "string"
    },
    "clickIds": {
      "fbclid": "string",
      "gclid": "string",
      "gbraid": "string",
      "wbraid": "string",
      "msclkid": "string"
    },
    "cookies": {
      "fbp": "string",
      "fbc": "string",
      "gaClientId": "string"
    }
  }
}
```

## Security And Privacy

- Store API secrets only on the server.
- Never expose privileged dashboard data to the widget.
- Validate `botId` and payload shape on every public API call.
- Validate `clientId` against a real client registry once the production database is added.
- Validate origin against a bot/client allowlist before production deployment.
- Rate-limit public endpoints per origin, IP, and bot.
- Use signed or opaque session identifiers, not sequential IDs.
- Keep a strict allowlist for domains allowed to embed each bot.
- Set Content Security Policy headers deliberately for embed pages.
- Validate every `postMessage` sender origin and message shape.
- Keep personally identifiable information out of browser logs and analytics payloads.
- Do not send lead names to Meta/GA4 payloads unless a future consent and hashing policy explicitly requires it.
- Keep Meta access tokens and GA4 API secrets server-side only.
- The MVP stores dashboard-managed bot secrets server-side in Postgres. Production hardening should move these values to encrypted columns or a secret manager.

## MVP Implementation Order

1. Done: replace the starter page with a real dashboard shell.
2. Done for MVP: add local JSON persistence behind a typed repository interface.
3. Done: add public chatbot flow configuration for Dra. Renata Reis.
4. Done: build the iframe chatbot UI.
5. Done: build `widget.js` loader.
6. Done for MVP: add public lead APIs.
7. Done for MVP: add dashboard lead list.
8. Done for MVP: add multi-chatbot catalog, bot cards, selected embed snippet, and bot/client filtering.
9. Done: capture lead attribution context and add optional Meta/GA4 server-side event dispatch.
10. Done for MVP: add dashboard chatbot creation with per-bot Meta and GA4 credential fields.
11. Done: add production persistence with Prisma/Postgres schema and migrations.
12. Done: add selectable conversation flows for dashboard-managed bots.
13. Done: add QA agent documentation and smoke runner.
14. Done: make the iframe interaction conversational with user-message echoes and bot typing states.
15. Next: add tests for remaining critical flows:
   - allowed-origin enforcement
   - full browser automation for every built-in flow
16. Done: add chat sessions, event timeline, automatic statuses, access metrics, date-range reporting, lead modal, CSV export, and no-mock failure handling.

## Validation Requirements

Before production use:

- `npm run lint`
- `npm run build`
- Unit tests for flow state and WhatsApp message formatting.
- API tests for public route validation and origin checks.
- `node qa/qa-agent.mjs` against local or production URLs.
- Browser test for real embed snippet on a representative external page.
- Live database test for bot creation, selected flow, lead persistence, and migration compatibility.
- Live database test for session creation, event append, linked lead detail, and automatic status derivation.
- Run `cd backend && npm run qa:live-db` with `DATABASE_URL` set after applying migrations. The check creates isolated `qa-live-*` data, validates access, lead linkage, timeline, automatic status, and trusted conversion, then deletes every QA row in a `finally` block.

## Open Decisions

- Authentication provider for the dashboard.
- WhatsApp destination per bot or per client.
- How far the dashboard editor should go beyond the current configuration form.
- Whether conversations require real-time updates or simple request/response persistence is enough for MVP.
