import { DashboardHeader } from "@/components/app-shell/DashboardHeader";
import { SimulationDashboard } from "@/components/simulation/SimulationDashboard";
import { toFreshnessInfo } from "@/lib/utils/freshness";

export default function SimulationPage() {
  const now = new Date().toISOString();
  const freshness = toFreshnessInfo({ priceDate: now.slice(0, 10), fetchedAt: now });

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader title="シミュレーション" freshness={freshness} />
      <SimulationDashboard />
    </div>
  );
}
