import { PageHeader } from "@/components/app-shell/PageHeader";
import { FavoritesDashboard } from "@/components/favorites/FavoritesDashboard";
import { getNavLabel } from "@/config/navigation";

export default function CandidatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={getNavLabel("/candidates")}
        description="個別株は「オルカンを買い増すより良いか」で判断し、1年後・3年後に答え合わせする"
      />
      <FavoritesDashboard />
    </div>
  );
}
