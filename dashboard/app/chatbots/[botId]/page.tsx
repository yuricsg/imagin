import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard";
import { BotReport } from "@/app/_components/bot-report";

export default async function BotReportPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const data = await getDashboardData();
  const bot = data.bots.find((entry) => entry.id === botId);

  if (!bot) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Chatbot não encontrado
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Esse bot não está na sua lista. Volte ao painel e tente de novo.
        </p>
        <Link href="/" className="btn-brand mt-4 inline-flex px-4 py-2">
          Voltar ao painel
        </Link>
      </main>
    );
  }

  return (
    <BotReport
      bot={bot}
      leads={data.leads.filter((lead) => lead.botId === botId)}
      accesses={data.accesses.filter((access) => access.botId === botId)}
      nowMs={data.nowMs}
    />
  );
}
