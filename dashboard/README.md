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

## Embed Snippet

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

## Validation

```bash
npm run lint
npm run build
```
