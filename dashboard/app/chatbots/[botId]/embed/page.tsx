import { EmbeddedChatbot } from "./embedded-chatbot";

type LeadSource = {
  pageUrl?: string;
  landingPageUrl?: string;
  referrer?: string;
  parentOrigin?: string;
  utm?: Record<string, string>;
  clickIds?: Record<string, string>;
  cookies?: Record<string, string>;
};

type PageProps = {
  params: Promise<{ botId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ChatbotEmbedPage({ params, searchParams }: PageProps) {
  const { botId } = await params;
  const query = await searchParams;

  return (
    <EmbeddedChatbot
      botId={botId}
      clientId={readQueryParam(query.clientId) ?? "unknown-client"}
      pageUrl={readQueryParam(query.pageUrl)}
      parentOrigin={readQueryParam(query.parentOrigin)}
      initialSource={readAttribution(query.attribution)}
    />
  );
}

function readQueryParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function readAttribution(value: string | string[] | undefined): LeadSource {
  const rawValue = readQueryParam(value);

  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);

    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}
