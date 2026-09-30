import { PageHeader } from "@/components/app-shell/PageHeader";
import { CandidatesDashboard } from "@/components/candidates/CandidatesDashboard";
import { getNavLabel } from "@/config/navigation";

export default function CandidatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={getNavLabel("/candidates")}
        description="個別株は「オルカンを買い増すより良いか」で判断し、1年後・3年後に答え合わせする"
      />
      <CandidatesDashboard />
    </div>
  );
}
