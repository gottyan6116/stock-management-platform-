"use client";

import type { Database } from "@/types/supabase";
import type { MetricKey } from "@/types/evidence";
import { AnalyticsPanel } from "@/components/ui/AnalyticsPanel";
import { ManualMetricForm, METRIC_KEY_LABEL } from "./ManualMetricForm";
import { formatDate } from "@/lib/utils/format";

type FinancialMetricRow = Database["public"]["Tables"]["financial_metrics"]["Row"];

// 手入力フォームはunit/currencyを収集しないため（値の意味は指標キーで決まる）、
// %表示すべき指標キーをここで判定する。importで実際にunit='percent'が来た場合もこれで代替可能。
// current_ratioは含めない — src/lib/scoring/quant-score.tsのスコアリングが
// 1.5のような「倍」表記を前提にしており（low:1, high:2）、ここを%扱いにすると
// 表示（150%）と採点（1.5として入力すべき値）の単位が食い違ってしまう。
const PERCENT_METRIC_KEYS = new Set<MetricKey>([
  "roe",
  "roic",
  "operating_margin",
  "net_margin",
  "dividend_yield",
  "dividend_payout",
  "fcf_yield",
  "fcf_margin",
]);

// AI構造化・JSON取り込みが付与するunitの自由記述のうち、既知の値だけ日本語の単位表記に変換する。
// 未知のunit文字列（自由記述なので何でも来得る）はcurrency表示か素の数値にフォールバックする。
const UNIT_SUFFIX_LABEL: Record<string, string> = {
  x: "倍",
  JPY_100M: "億円",
  JPY_TRILLION: "兆円",
  JPY_PER_SHARE: "円/株",
};

function formatMetricValue(row: FinancialMetricRow): string {
  const formatted = row.value.toLocaleString("ja-JP", { maximumFractionDigits: 4 });
  const isPercent = row.unit === "percent" || PERCENT_METRIC_KEYS.has(row.metric_key as MetricKey);
  if (isPercent) return `${formatted}%`;
  const unitSuffix = row.unit ? UNIT_SUFFIX_LABEL[row.unit] : undefined;
  if (unitSuffix) return `${formatted}${unitSuffix}`;
  if (row.currency) return `${row.currency} ${formatted}`;
  return formatted;
}

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
                      {METRIC_KEY_LABEL[row.metric_key] ?? row.metric_key}
                    </td>
                    <td className="py-2 pr-4 text-text-primary">{formatMetricValue(row)}</td>
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
