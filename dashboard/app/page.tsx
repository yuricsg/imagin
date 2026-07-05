import { DashboardHome } from "./_components/dashboard-home";
import { getDashboardData } from "@/lib/dashboard";

export default async function Home() {
  const data = await getDashboardData();
  return <DashboardHome data={data} />;
}
