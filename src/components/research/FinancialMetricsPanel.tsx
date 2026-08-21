"use client";

import type { Database } from "@/types/supabase";
import { AnalyticsPanel } from "@/components/ui/AnalyticsPanel";
import { ManualMetricForm, METRIC_KEY_LABEL } from "./ManualMetricForm";
import { formatDate } from "@/lib/utils/format";

type FinancialMetricRow = Database["public"]["Tables"]["financial_metrics"]["Row"];

function formatPeriod(row: FinancialMetricRow): string {
  const label = row.period_type === "FY" ? "通期" : "四半期";
  return `${label} ${formatDate(row.period_start)} 〜 ${formatDate(row.period_end)}`;
}

export function FinancialMetricsPanel({
  providerSymbol,
  metrics,
}: {
  providerSymbol: string;
  metrics: FinancialMetricRow[];
}) {
  return (
    <div className="space-y-4">
      <AnalyticsPanel title="決算・財務">
        {metrics.length === 0 ? (
          <>
            <p className="text-sm font-semibold text-text-primary">実データはまだ接続されていません</p>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              決算書と財務指標の実データは未接続です。下のフォームから手入力するか、リサーチタブからJSON取り込みで登録できます。
            </p>
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="py-2 pr-4">指標</th>
                  <th className="py-2 pr-4">値</th>
                  <th className="py-2 pr-4">対象期間</th>
                  <th className="py-2 pr-4">出所</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 font-semibold text-text-primary">
                      {METRIC_KEY_LABEL[row.metric_key as keyof typeof METRIC_KEY_LABEL] ?? row.metric_key}
                    </td>
                    <td className="py-2 pr-4 text-text-primary">
                      {row.value}
                      {row.unit === "percent" ? "%" : ""}
                    </td>
                    <td className="py-2 pr-4 text-text-secondary">{formatPeriod(row)}</td>
                    <td className="py-2 pr-4 text-text-muted">{row.is_manual ? "手入力" : "インポート"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AnalyticsPanel>

      <AnalyticsPanel title="指標を手入力">
        <ManualMetricForm providerSymbol={providerSymbol} />
      </AnalyticsPanel>
    </div>
  );
}
