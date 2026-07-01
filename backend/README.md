# Imagin Backend

Hono API for embeddable chatbot lead capture.

```
npm install
npx prisma generate
npm run dev
```

Default URL: `http://localhost:4000`.

## Routes

- `GET /health` returns API health.
- `GET /api/chatbots` lists configured chatbots for the dashboard.
- `POST /api/chatbots` creates a dashboard-managed chatbot.
- `GET /api/public/chatbots/dra-renata-reis/config` returns public chatbot configuration.
- `POST /api/public/chatbots/dra-renata-reis/leads` stores one lead submission and returns the WhatsApp handoff message.
- `GET /api/leads` lists captured leads for the dashboard MVP.
- `GET /api/leads?botId=dra-renata-reis` filters leads by chatbot.
- `GET /api/leads?clientId=clinica-renata` filters leads by client.

## Attribution And Tracking

The widget sends attribution data with each lead:

- Page URL and landing page URL.
- Referrer and parent origin.
- UTM parameters.
- Click IDs: `fbclid`, `gclid`, `gbraid`, `wbraid`, `msclkid`.
- Browser cookies used for server-side attribution: `_fbp`, `_fbc`, and GA client ID parsed from `_ga`.

When configured, the backend sends a non-blocking server-side lead event to:

- Meta Conversions API with `event_name=Lead`.
- Google Analytics 4 Measurement Protocol with `event=generate_lead`.

Provider failures do not block lead creation.

## Tracking Environment Variables

Use per-bot env vars when possible:

```bash
RENATA_REIS_META_PIXEL_ID=
RENATA_REIS_META_ACCESS_TOKEN=
RENATA_REIS_META_TEST_EVENT_CODE=
RENATA_REIS_GA4_MEASUREMENT_ID=
RENATA_REIS_GA4_API_SECRET=
```

Shared fallback vars are also supported:

```bash
META_PIXEL_ID=
META_ACCESS_TOKEN=
META_TEST_EVENT_CODE=
META_GRAPH_API_VERSION=v25.0
GA4_MEASUREMENT_ID=
GA4_API_SECRET=
```

The dashboard creation form can also save per-bot Meta and GA4 credentials. These values are accepted by `POST /api/chatbots`, stored server-side, and only exposed back to the dashboard/widget as boolean integration status.

Never expose access tokens or API secrets in the widget snippet or public chatbot config.

## Chatbot Catalog

Static bots are registered in `src/chatbots/catalog.ts`. Dashboard-managed bots are stored through Prisma/Postgres in `src/chatbots/prisma-chatbot-repository.ts`. The file repository remains available for focused tests. Each bot implements the shared `ChatbotDefinition` contract from `src/chatbots/types.ts`.

Every bot has a `flowKey`:

- `cardiology_exam_consultation`
- `exam_scheduling`
- `consultation_scheduling`
- `urgent_triage`

The public config includes `flowKey` and `conversationFlow`; the embed uses this to render only the intents enabled for that bot.

To add another code-defined bot:

1. Create a new file in `src/chatbots/`.
2. Export a `ChatbotDefinition`.
3. Add it to the `staticChatbotDefinitions` array in `src/chatbots/catalog.ts`.
4. Configure server-side tracking credentials on the bot definition.
5. Add or update tests for config exposure, validation rules, WhatsApp message formatting, and tracking payloads.

To add a dashboard-managed bot, use `POST /api/chatbots` or the dashboard form. The API requires bot/client identifiers, `flowKey`, flow option lists, WhatsApp destination, and optional `tracking.meta` / `tracking.googleAnalytics` credentials.

## Persistence

The runtime repositories use Prisma/Postgres and require `DATABASE_URL`. Generate the Prisma client after installing dependencies:

```bash
npx prisma generate
```

Apply migrations with:

```bash
npx prisma migrate deploy
```

Local JSON repositories under `src/*/file-*-repository.ts` are intended for tests and isolated local validation.

## Validation

```
npm run test
npm run build
node ../qa/qa-agent.mjs --api-url=http://localhost:4000 --dashboard-url=http://localhost:3002
```
