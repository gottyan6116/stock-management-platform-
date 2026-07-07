import { DashboardHeader } from "@/components/app-shell/DashboardHeader";
import { PortfolioDashboard } from "@/components/portfolio/PortfolioDashboard";
import { toFreshnessInfo } from "@/lib/utils/freshness";

export default function PortfolioPage() {
  const now = new Date().toISOString();
  const freshness = toFreshnessInfo({ priceDate: now.slice(0, 10), fetchedAt: now });

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader title="ポートフォリオ" freshness={freshness} />
      <PortfolioDashboard />
    </div>
  );
}
