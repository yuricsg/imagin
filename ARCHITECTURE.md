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
- Persistence: local JSON file storage in `backend/data/leads.json` and `backend/data/chatbots.json`.
- Attribution: widget captures UTM parameters, click IDs, referrer, page URL, landing page URL, `_fbp`, `_fbc`, and GA client ID from `_ga`.
- Tracking dispatch: backend can send Meta Conversions API and GA4 Measurement Protocol events after lead creation.
- Authentication: not configured.
- Multi-client model: `botId` and `clientId` are accepted, stored, listed, and filterable, but there is no authenticated organization/client model yet.

The current MVP is intentionally small. It proves the embed-to-dashboard lead path before committing to a production database, authentication provider, or visual bot editor.

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

## Recommended Embed Strategy

Use a small script loader on the client site that injects an iframe-hosted widget.

Example client install snippet:

```html
<script
  src="https://app.imagin.com.br/embed/widget.js"
  data-api-base-url="https://api.imagin.com.br"
  data-bot-id="dra-renata-reis"
  data-client-id="client_id"
></script>
```

The script should:

- Render the floating launcher button.
- Create an iframe only when the widget is opened, unless preloading is explicitly enabled.
- Pass only public configuration to the iframe.
- Use `postMessage` for parent/iframe resize, open, close, and analytics events.
- Avoid storing sensitive data on the client site.

The iframe should:

- Load from the Imagin domain.
- Run the actual chatbot UI.
- Submit lead events directly to Imagin APIs.
- Open WhatsApp in a new tab only after explicit user action.

This approach is preferred over giving clients a raw iframe because the script keeps installation simple while the iframe isolates CSS, JavaScript, storage, and future UI changes. Shadow DOM can be revisited later for a lighter native-feeling widget, but iframe isolation is the safer default for many unrelated client websites.

## Suggested Routes

Use the Hono backend for APIs and the Next.js dashboard for the widget UI.

Public widget routes:

- `GET /embed/widget.js`: script loader served with long-lived caching and versioning.
- `GET /chatbots/[botId]/embed`: iframe UI route.
- `GET /api/public/chatbots/[botId]/config`: public-safe bot configuration on the Hono backend.
- `POST /api/public/chatbots/[botId]/leads`: creates lead records on the Hono backend.
- Optional tracking side effects from the lead endpoint:
  - Meta Conversions API `Lead` event.
  - GA4 Measurement Protocol `generate_lead` event.

Dashboard routes:

- `GET /`: lead overview.
- `GET /api/chatbots`: configured chatbot catalog on the Hono backend.
- `POST /api/chatbots`: creates a dashboard-managed chatbot with private tracking credentials stored server-side.
- `GET /api/leads`: lead list on the Hono backend.
- `GET /api/leads?botId=[botId]`: bot-scoped lead list.
- `GET /api/leads?clientId=[clientId]`: client-scoped lead list.

Planned routes:

- `POST /api/public/chatbots/[botId]/sessions`: create a visitor chat session.
- `POST /api/public/chatbots/[botId]/events`: append message or state-transition events.
- `GET /dashboard/leads/[leadId]`: lead detail and conversation timeline.
- `GET /dashboard/chatbots`: chatbot list.
- `GET /dashboard/chatbots/[botId]`: flow/config editor.

## Suggested Data Model

Core entities:

- `organizations`
  - Owns clients, users, chatbots, and leads.
- `clients`
  - Represents a customer/site where a bot is installed.
- `chatbots`
  - Stores bot metadata, public slug, active status, and default WhatsApp destination.
- `chatbot_versions`
  - Stores versioned flow definitions so historic leads remain explainable after bot edits.
- `chat_sessions`
  - Tracks one visitor interaction from a site/session.
- `chat_messages`
  - Stores normalized user and bot messages.
- `lead_submissions`
  - Stores structured lead fields and current lead status.
- `lead_events`
  - Stores timeline events: opened, answered name, selected intent, submitted WhatsApp, handed off, closed.
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
- The MVP stores dashboard-managed bot secrets in local JSON for development only. Production storage must move these values to an encrypted database column or a secret manager.

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
11. Next: add production persistence with schema and migrations.
12. Next: add tests for remaining critical flows:
   - session creation
   - consultation lead API submission
   - severe symptom handoff
   - allowed-origin enforcement
   - browser-level embed flow

## Validation Requirements

Before production use:

- `npm run lint`
- `npm run build`
- Unit tests for flow state and WhatsApp message formatting.
- API tests for public route validation and origin checks.
- Browser test for real embed snippet on a representative external page.
- Live database test for session, message, and lead persistence after the production database provider is chosen.

## Open Decisions

- Database provider.
- Authentication provider for the dashboard.
- WhatsApp destination per bot or per client.
- How far the dashboard editor should go beyond the current configuration form.
- Whether conversations require real-time updates or simple request/response persistence is enough for MVP.
