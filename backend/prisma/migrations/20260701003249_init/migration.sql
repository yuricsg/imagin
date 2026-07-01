-- CreateTable
CREATE TABLE "bots" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "description" TEXT NOT NULL DEFAULT '',
    "whatsappPhone" TEXT NOT NULL,
    "buttonTexts" TEXT[],
    "examOptions" TEXT[],
    "medicalRequestOptions" TEXT[],
    "consultationNeeds" TEXT[],
    "consultationDecisions" TEXT[],
    "metaPixelId" TEXT,
    "metaAccessToken" TEXT,
    "metaTestEventCode" TEXT,
    "gasMeasurementId" TEXT,
    "gaApiSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "selectedExams" TEXT[],
    "medicalRequestStatus" TEXT,
    "consultationNeed" TEXT,
    "consultationDecision" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "whatsappMessage" TEXT NOT NULL,
    "whatsappUrl" TEXT NOT NULL,
    "pageUrl" TEXT,
    "landingPageUrl" TEXT,
    "referrer" TEXT,
    "parentOrigin" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "utmId" TEXT,
    "fbclid" TEXT,
    "gclid" TEXT,
    "fbp" TEXT,
    "fbc" TEXT,
    "gaClientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_botId_idx" ON "leads"("botId");

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
