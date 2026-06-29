# Imagin Backend

Hono API for embeddable chatbot lead capture.

```
npm install
npm run dev
```

Default URL: `http://localhost:4000`.

## Routes

- `GET /health` returns API health.
- `GET /api/chatbots` lists configured chatbots for the dashboard.
- `GET /api/public/chatbots/dra-renata-reis/config` returns public chatbot configuration.
- `POST /api/public/chatbots/dra-renata-reis/leads` stores one lead submission and returns the WhatsApp handoff message.
- `GET /api/leads` lists captured leads for the dashboard MVP.
- `GET /api/leads?botId=dra-renata-reis` filters leads by chatbot.
- `GET /api/leads?clientId=clinica-renata` filters leads by client.

## Chatbot Catalog

Configured bots are registered in `src/chatbots/catalog.ts`. Each bot implements the shared `ChatbotDefinition` contract from `src/chatbots/types.ts`.

To add another bot:

1. Create a new file in `src/chatbots/`.
2. Export a `ChatbotDefinition`.
3. Add it to the `chatbotDefinitions` array in `src/chatbots/catalog.ts`.
4. Add or update tests for config exposure, validation rules, and WhatsApp message formatting.

## Local Persistence

Until the production database provider is chosen, leads are stored in `data/leads.json`. The directory is ignored by git and is only intended for local MVP validation.

## Validation

```
npm run test
npm run build
```
