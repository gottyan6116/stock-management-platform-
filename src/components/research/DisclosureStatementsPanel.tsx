import type { Database } from "@/types/supabase";
import { AnalyticsPanel } from "@/components/ui/AnalyticsPanel";
import { formatDate } from "@/lib/utils/format";

type ManagementStatementRow = Database["public"]["Tables"]["management_statements"]["Row"];
type CompanyEventRow = Database["public"]["Tables"]["company_events"]["Row"];

const TOPIC_LABEL: Record<ManagementStatementRow["topic"], string> = {
  guidance: "業績見通し",
  strategy: "経営戦略",
  margin: "利益率",
  capital_allocation: "資本配分",
  m_and_a: "M&A",
  ai: "AI",
  product: "製品・サービス",
  international: "海外展開",
  shareholder_return: "株主還元",
  risk: "リスク",
  competition: "競争環境",
  other: "その他",
};

const EVENT_TYPE_LABEL: Record<CompanyEventRow["event_type"], string> = {
  earnings: "決算発表",
  guidance: "業績見通し修正",
  m_and_a: "M&A",
  buyback: "自己株買い",
  dividend: "配当",
  capital_raise: "資金調達",
  product: "製品・サービス",
  regulation: "規制",
  lawsuit: "訴訟",
  management_change: "経営陣交代",
  restructuring: "事業再編",
  partnership: "提携",
  other: "その他",
};

export function DisclosureStatementsPanel({
  statements,
  events,
}: {
  statements: ManagementStatementRow[];
  events: CompanyEventRow[];
}) {
  return (
    <div className="space-y-4">
      <AnalyticsPanel title="経営者・投資家の発言">
        {statements.length === 0 ? (
          <>
            <p className="text-sm font-semibold text-text-primary">実データはまだ接続されていません</p>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              経営者や投資家の発言データは未接続です。リサーチタブから資料を取り込む（またはAIで構造化する）と、ここに表示されます。
            </p>
          </>
        ) : (
          <ul className="flex flex-col gap-3">
            {statements.map((row) => (
              <li key={row.id} className="rounded-button border border-border p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span className="rounded-button bg-surface-subtle px-2 py-0.5 font-semibold text-text-secondary">
                    {TOPIC_LABEL[row.topic] ?? row.topic}
                  </span>
                  <span className="font-semibold text-text-primary">
                    {row.person_name}
                    {row.role ? `（${row.role}）` : ""}
                  </span>
                  {row.statement_date ? <span>· {formatDate(row.statement_date)}</span> : null}
                </div>
                <p className="mt-1.5 text-sm text-text-primary">{row.statement}</p>
              </li>
            ))}
          </ul>
        )}
      </AnalyticsPanel>

      <AnalyticsPanel title="重要発表・M&A">
        {events.length === 0 ? (
          <>
            <p className="text-sm font-semibold text-text-primary">実データはまだ接続されていません</p>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              適時開示や決算発表日などのイベントデータは未接続です。リサーチタブから資料を取り込む（またはAIで構造化する）と、ここに表示されます。
            </p>
          </>
        ) : (
          <ul className="flex flex-col gap-3">
            {events.map((row) => (
              <li key={row.id} className="rounded-button border border-border p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span className="rounded-button bg-surface-subtle px-2 py-0.5 font-semibold text-text-secondary">
                    {EVENT_TYPE_LABEL[row.event_type] ?? row.event_type}
                  </span>
                  <span>{formatDate(row.event_date)}</span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-text-primary">{row.title}</p>
                {row.description ? <p className="mt-0.5 text-sm text-text-secondary">{row.description}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </AnalyticsPanel>
    </div>
  );
}
