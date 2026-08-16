import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Database } from "lucide-react";
import { GlobalStockSearch } from "@/components/search/GlobalStockSearch";
import { EmptyState } from "@/components/feedback/EmptyState";
import { RESEARCH_SECTIONS } from "@/config/research-sections";

export default function ResearchSectionPage({ params }: { params: { section: string } }) {
  const section = RESEARCH_SECTIONS.find((candidate) => candidate.slug === params.section);

  if (!section) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">銘柄リサーチ</p>
          <h1 className="text-2xl font-bold text-text-primary md:text-[30px]">{section.title}</h1>
        </div>
        <GlobalStockSearch />
      </header>

      <EmptyState
        icon={Database}
        title="分析データがまだありません"
        description="実データ連携前のため、サンプルの分析結果は表示していません。銘柄を検索するか、関連画面をご利用ください。"
        action={
          <Link
            href={section.relatedHref}
            className="inline-flex items-center gap-2 rounded-button bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            {section.relatedLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />
    </div>
  );
}
