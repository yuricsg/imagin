import type { ChatbotDefinition } from "../chatbots/types.js";
import type { LeadRecord, LeadSource } from "../leads/types.js";
import type {
  TrackingDispatchResult,
  TrackingRequestContext,
  TrackingService,
} from "./types.js";

type FetchLike = typeof fetch;

type TrackingServiceOptions = {
  fetchImpl?: FetchLike;
  now?: () => Date;
  metaGraphVersion?: string;
};

export function createTrackingService(
  options: TrackingServiceOptions = {},
): TrackingService {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const metaGraphVersion =
    options.metaGraphVersion ?? process.env.META_GRAPH_API_VERSION ?? "v25.0";

  return {
    async trackLeadCreated(lead, chatbot, context) {
      const results = await Promise.all([
        sendMetaLeadEvent({
          chatbot,
          context,
          fetchImpl,
          lead,
          metaGraphVersion,
          now,
        }),
        sendGa4LeadEvent({ chatbot, fetchImpl, lead }),
      ]);

      return results;
    },
  };
}

type MetaPayloadInput = {
  chatbot: ChatbotDefinition;
  context: TrackingRequestContext;
  lead: LeadRecord;
  now: () => Date;
};

export function buildMetaLeadPayload({
  chatbot,
  context,
  lead,
  now,
}: MetaPayloadInput) {
  const userData = compactObject({
    client_ip_address: context.ipAddress,
    client_user_agent: context.userAgent,
    fbc: lead.source.cookies?.fbc,
    fbp: lead.source.cookies?.fbp,
  });

  const event = {
    event_name: "Lead",
    event_time: Math.floor(now().getTime() / 1000),
    event_id: lead.id,
    action_source: "website",
    event_source_url: lead.source.pageUrl ?? lead.source.landingPageUrl,
    user_data: userData,
    custom_data: compactObject({
      bot_id: lead.botId,
      chatbot_name: chatbot.name,
      client_id: lead.clientId,
      client_name: chatbot.clientName,
      lead_intent: lead.intent,
      utm_source: lead.source.utm?.source,
      utm_medium: lead.source.utm?.medium,
      utm_campaign: lead.source.utm?.campaign,
      utm_content: lead.source.utm?.content,
      utm_term: lead.source.utm?.term,
      fbclid: lead.source.clickIds?.fbclid,
      gclid: lead.source.clickIds?.gclid,
    }),
  };

  return compactObject({
    data: [event],
    test_event_code: chatbot.tracking.meta?.testEventCode,
  });
}

type Ga4PayloadInput = {
  chatbot: ChatbotDefinition;
  lead: LeadRecord;
};

export function buildGa4LeadPayload({ chatbot, lead }: Ga4PayloadInput) {
  return {
    client_id: lead.source.cookies?.gaClientId ?? lead.id,
    events: [
      {
        name: "generate_lead",
        params: compactObject({
          engagement_time_msec: 1,
          lead_id: lead.id,
          bot_id: lead.botId,
          chatbot_name: chatbot.name,
          client_id: lead.clientId,
          client_name: chatbot.clientName,
          lead_intent: lead.intent,
          page_location: lead.source.pageUrl,
          page_referrer: lead.source.referrer,
          campaign_source: lead.source.utm?.source,
          campaign_medium: lead.source.utm?.medium,
          campaign_name: lead.source.utm?.campaign,
          campaign_content: lead.source.utm?.content,
          campaign_term: lead.source.utm?.term,
          gclid: lead.source.clickIds?.gclid,
          gbraid: lead.source.clickIds?.gbraid,
          wbraid: lead.source.clickIds?.wbraid,
          fbclid: lead.source.clickIds?.fbclid,
        }),
      },
    ],
  };
}

async function sendMetaLeadEvent({
  chatbot,
  context,
  fetchImpl,
  lead,
  metaGraphVersion,
  now,
}: MetaPayloadInput & {
  fetchImpl: FetchLike;
  metaGraphVersion: string;
}): Promise<TrackingDispatchResult> {
  const pixelId = chatbot.tracking.meta?.pixelId;
  const accessToken = chatbot.tracking.meta?.accessToken;

  if (!pixelId || !accessToken) {
    return {
      provider: "meta",
      status: "skipped",
      reason: "Meta pixel ID or access token is not configured",
    };
  }

  try {
    const url = new URL(
      `https://graph.facebook.com/${metaGraphVersion}/${pixelId}/events`,
    );
    url.searchParams.set("access_token", accessToken);

    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildMetaLeadPayload({ chatbot, context, lead, now })),
    });

    if (!response.ok) {
      return {
        provider: "meta",
        status: "failed",
        reason: `Meta responded with ${response.status}`,
      };
    }

    return { provider: "meta", status: "sent" };
  } catch (error) {
    return {
      provider: "meta",
      status: "failed",
      reason: error instanceof Error ? error.message : "Unknown Meta error",
    };
  }
}

async function sendGa4LeadEvent({
  chatbot,
  fetchImpl,
  lead,
}: Ga4PayloadInput & { fetchImpl: FetchLike }): Promise<TrackingDispatchResult> {
  const measurementId = chatbot.tracking.googleAnalytics?.measurementId;
  const apiSecret = chatbot.tracking.googleAnalytics?.apiSecret;

  if (!measurementId || !apiSecret) {
    return {
      provider: "google_analytics",
      status: "skipped",
      reason: "GA4 measurement ID or API secret is not configured",
    };
  }

  try {
    const url = new URL("https://www.google-analytics.com/mp/collect");
    url.searchParams.set("measurement_id", measurementId);
    url.searchParams.set("api_secret", apiSecret);

    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildGa4LeadPayload({ chatbot, lead })),
    });

    if (!response.ok) {
      return {
        provider: "google_analytics",
        status: "failed",
        reason: `GA4 responded with ${response.status}`,
      };
    }

    return { provider: "google_analytics", status: "sent" };
  } catch (error) {
    return {
      provider: "google_analytics",
      status: "failed",
      reason: error instanceof Error ? error.message : "Unknown GA4 error",
    };
  }
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== ""),
  );
}

export function summarizeLeadSource(source: LeadSource) {
  if (source.utm?.source) {
    return [
      source.utm.source,
      source.utm.medium,
      source.utm.campaign,
    ]
      .filter(Boolean)
      .join(" / ");
  }

  if (source.clickIds?.gclid || source.clickIds?.gbraid || source.clickIds?.wbraid) {
    return "google_ads";
  }

  if (source.clickIds?.fbclid || source.cookies?.fbc || source.cookies?.fbp) {
    return "meta";
  }

  return source.referrer ?? source.parentOrigin ?? source.pageUrl ?? "direct";
}
