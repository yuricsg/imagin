import { getDashboardData } from "@/lib/dashboard";
import { BotReportClient } from "@/app/_components/bot-report";

export default async function BotReportPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const data = await getDashboardData();

  // Bot resolution happens on the client so dashboard bots that live only in
  // localStorage (not yet persisted to the DB) still reach their report.
  return (
    <BotReportClient
      botId={botId}
      serverBots={data.bots}
      leads={data.leads}
      accesses={data.accesses}
      nowMs={data.nowMs}
    />
  );
}
