-- AddColumn: dashboardConfig for storing full dashboard Chatbot JSON
ALTER TABLE "bots" ADD COLUMN "dashboardConfig" JSONB;
