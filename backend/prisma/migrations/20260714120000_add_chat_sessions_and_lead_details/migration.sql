ALTER TABLE "leads"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "message" TEXT,
  ADD COLUMN "customFields" JSONB,
  ADD COLUMN "answers" JSONB,
  ADD COLUMN "flowMode" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "whatsappDestinationId" TEXT,
  ADD COLUMN "sessionId" TEXT;

CREATE UNIQUE INDEX "leads_sessionId_key" ON "leads"("sessionId");

CREATE TABLE "chat_sessions" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "leadId" TEXT,
  "visitorName" TEXT,
  "intent" TEXT,
  "flowMode" TEXT NOT NULL DEFAULT 'legacy',
  "currentStep" TEXT,
  "answers" JSONB,
  "source" JSONB,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "flowCompletedAt" TIMESTAMP(3),
  "whatsappClickedAt" TIMESTAMP(3),
  "appointmentRequestedAt" TIMESTAMP(3),
  "notInterestedAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_events" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "stepId" TEXT,
  "label" TEXT,
  "value" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_sessions_leadId_key" ON "chat_sessions"("leadId");
CREATE INDEX "chat_sessions_botId_openedAt_idx" ON "chat_sessions"("botId", "openedAt");
CREATE INDEX "chat_sessions_clientId_openedAt_idx" ON "chat_sessions"("clientId", "openedAt");
CREATE INDEX "chat_sessions_lastActivityAt_idx" ON "chat_sessions"("lastActivityAt");
CREATE INDEX "chat_events_sessionId_createdAt_idx" ON "chat_events"("sessionId", "createdAt");
CREATE INDEX "chat_events_botId_createdAt_idx" ON "chat_events"("botId", "createdAt");

ALTER TABLE "chat_events"
  ADD CONSTRAINT "chat_events_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
