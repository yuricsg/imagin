# Imagin Dashboard

Next.js dashboard and embeddable chatbot UI for Imagin lead capture. The dashboard is a multi-chatbot operations surface; the Dra. Renata Reis bot is only the first configured bot.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The dashboard expects the backend at `http://localhost:4000` by default. Override it with:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 npm run dev
```

When running the dashboard on a non-default port, also set the widget origin used in the dashboard snippet:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 NEXT_PUBLIC_WIDGET_BASE_URL=http://localhost:3002 npm run dev -- --port 3002
```

## Chatbot Creation

The home dashboard includes a creation form for dashboard-managed chatbots. It posts to the backend `POST /api/chatbots` endpoint and supports:

- Bot and client identifiers.
- Conversation flow:
  - consultation + exams
  - exams only
  - consultation only
  - urgent triage only
- WhatsApp destination.
- Floating button text and flow option lists.
- Meta Pixel ID, Meta access token, Meta test event code.
- GA4 measurement ID and GA4 API secret.

Each key field includes help text explaining where to find the value and what it does. The backend returns only integration status flags to the dashboard. Meta access tokens and GA4 API secrets are not included in public chatbot configuration or widget snippets.

## Embed Snippet

In the dashboard, select a chatbot in the sidebar and use the **Instalação no site do cliente** card to copy either the recommended script or the direct iframe snippet.

The client site can load a chatbot with:

```html
<script
  src="http://localhost:3000/embed/widget.js"
  data-api-base-url="http://localhost:4000"
  data-bot-id="dra-renata-reis"
  data-client-id="clinica-renata"
></script>
```

The widget iframe lives at `/chatbots/[botId]/embed`. The script fetches public bot configuration from the backend, then injects the floating launcher and iframe.

The iframe keeps a conversation-style timeline: the visitor's name and option choices are echoed as user bubbles, bot responses are delayed with a typing indicator, and the next controls only appear after the bot message sequence finishes. This keeps the guided flow feeling like a chat instead of an instant form.

The widget automatically forwards attribution context to the backend:

- UTM parameters.
- `fbclid`, `gclid`, `gbraid`, `wbraid`, and `msclkid`.
- Browser cookies `_fbp`, `_fbc`, and GA client ID from `_ga` when available.
- Current page URL, first landing page URL for the browser session, referrer, and parent origin.

Do not add Meta or GA4 secrets to this snippet. Server-side tracking credentials belong in the backend environment or in the dashboard-managed chatbot configuration.

## Validation

```bash
npm run lint
npm run build
node ../qa/qa-agent.mjs --dashboard-url=http://localhost:3002 --api-url=http://localhost:4000
```
