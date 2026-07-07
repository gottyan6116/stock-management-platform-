import { DashboardHeader } from "@/components/app-shell/DashboardHeader";
import { FundsDashboard } from "@/components/funds/FundsDashboard";
import { toFreshnessInfo } from "@/lib/utils/freshness";

export default function FundsPage() {
  const now = new Date().toISOString();
  const freshness = toFreshnessInfo({ priceDate: now.slice(0, 10), fetchedAt: now });

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader title="投資信託" freshness={freshness} />
      <FundsDashboard />
    </div>
  );
}
