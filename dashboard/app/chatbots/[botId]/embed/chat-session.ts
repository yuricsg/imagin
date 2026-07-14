export type LeadSource = {
  pageUrl?: string;
  landingPageUrl?: string;
  referrer?: string;
  parentOrigin?: string;
  utm?: Record<string, string>;
  clickIds?: Record<string, string>;
  cookies?: Record<string, string>;
};

export type ChatSessionEvent = {
  type:
    | "name_captured"
    | "intent_selected"
    | "answer_submitted"
    | "flow_completed"
    | "whatsapp_clicked";
  stepId?: string;
  label?: string;
  value?: string | string[];
  name?: string;
  intent?: "schedule_exam" | "schedule_consultation" | "severe_symptoms";
  flowMode?: "legacy" | "custom_dialogue";
};

export type ChatSessionTracker = {
  ensureSession(): Promise<string | null>;
  trackEvent(event: ChatSessionEvent): Promise<void>;
  flush(): Promise<void>;
};

export function createChatSessionTracker({
  apiBaseUrl,
  botId,
  clientId,
  source,
  fetcher = fetch,
}: {
  apiBaseUrl: string;
  botId: string;
  clientId: string;
  source: LeadSource;
  fetcher?: typeof fetch;
}): ChatSessionTracker {
  const sessionsUrl = `${apiBaseUrl}/api/public/chatbots/${encodeURIComponent(botId)}/sessions`;
  let sessionPromise: Promise<string | null> | null = null;
  let eventQueue: Promise<void> = Promise.resolve();

  function ensureSession() {
    if (!sessionPromise) {
      sessionPromise = fetcher(sessionsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, source }),
      })
        .then(async (response) => {
          if (!response.ok) return null;
          const body = (await response.json()) as { session?: { id?: unknown } };
          return typeof body.session?.id === "string" ? body.session.id : null;
        })
        .catch(() => null);
    }
    return sessionPromise;
  }

  function trackEvent(event: ChatSessionEvent) {
    eventQueue = eventQueue.then(async () => {
      const sessionId = await ensureSession();
      if (!sessionId) return;
      await fetcher(`${sessionsUrl}/${encodeURIComponent(sessionId)}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      }).catch(() => undefined);
    });
    return eventQueue;
  }

  return {
    ensureSession,
    trackEvent,
    flush: () => eventQueue,
  };
}
