import { DashboardHeader } from "@/components/app-shell/DashboardHeader";
import { FavoritesDashboard } from "@/components/favorites/FavoritesDashboard";
import { toFreshnessInfo } from "@/lib/utils/freshness";

const NOW = new Date().toISOString();

export default function FavoritesPage() {
  const freshness = toFreshnessInfo({
    priceDate: NOW.slice(0, 10),
    fetchedAt: NOW,
  });

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader title="お気に入り銘柄" freshness={freshness} />
      <FavoritesDashboard />
    </div>
  );
}
