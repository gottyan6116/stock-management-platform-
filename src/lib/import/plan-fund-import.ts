import { normalizeFundName, type FundCsvRow, type ImportNisaType } from "./rakuten-fund-csv";

export interface ExistingFundInstrument {
  id: string;
  name: string;
}

export interface ExistingFundPosition {
  id: string;
  instrumentId: string;
  nisaType: ImportNisaType;
  quantity: number;
  /** 1万口あたり取得単価（DBの保存値） */
  avgCost: number | null;
  manualUnitPrice: number | null;
}

export type ImportAction = "create" | "update" | "unchanged";

export interface ImportPlanItem {
  row: FundCsvRow;
  action: ImportAction;
  /** null は新規のファンド（反映時にinstrumentを作る） */
  instrumentId: string | null;
  /** null は新規の保有 */
  positionId: string | null;
  before: { quantity: number; avgCost: number | null; nav: number | null } | null;
}

export interface ImportPlan {
  items: ImportPlanItem[];
  warnings: string[];
  /** CSVに無かった既存ファンド保有の件数。削除はしない。 */
  untouchedCount: number;
}

const COST_EPSILON = 0.005;

function sameNumber(a: number | null, b: number | null, epsilon = 0): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= epsilon;
}

/**
 * CSVの行を既存の保有・ファンドと突き合わせて、何が起きるかを決める（DBは触らない）。
 * プレビューと反映で同じ計画を使うため、ここが唯一の判断箇所。
 * CSVに無い既存保有は変更も削除もしない。
 */
export function planFundImport(
  rows: FundCsvRow[],
  instruments: ExistingFundInstrument[],
  positions: ExistingFundPosition[]
): ImportPlan {
  const byNormalizedName = new Map<string, ExistingFundInstrument>();
  for (const instrument of instruments) {
    const key = normalizeFundName(instrument.name);
    if (!byNormalizedName.has(key)) byNormalizedName.set(key, instrument);
  }

  const warnings: string[] = [];
  const seen = new Set<string>();
  const touched = new Set<string>();
  const items: ImportPlanItem[] = [];

  for (const row of rows) {
    const nameKey = normalizeFundName(row.name);
    const dedupeKey = `${nameKey}|${row.nisaType ?? "taxable"}`;
    if (seen.has(dedupeKey)) {
      warnings.push(`「${row.name}」（${row.accountLabel}）がCSV内に複数あるため、2行目以降は取り込みません。`);
      continue;
    }
    seen.add(dedupeKey);

    const instrument = byNormalizedName.get(nameKey) ?? null;
    const position = instrument
      ? (positions.find((p) => p.instrumentId === instrument.id && p.nisaType === row.nisaType) ?? null)
      : null;

    if (!position) {
      items.push({ row, action: "create", instrumentId: instrument?.id ?? null, positionId: null, before: null });
      continue;
    }

    touched.add(position.id);
    const unchanged =
      sameNumber(position.quantity, row.quantity) &&
      sameNumber(position.avgCost, row.avgCostPer10k, COST_EPSILON) &&
      sameNumber(position.manualUnitPrice, row.nav);
    items.push({
      row,
      action: unchanged ? "unchanged" : "update",
      instrumentId: position.instrumentId,
      positionId: position.id,
      before: { quantity: position.quantity, avgCost: position.avgCost, nav: position.manualUnitPrice },
    });
  }

  return { items, warnings, untouchedCount: positions.filter((p) => !touched.has(p.id)).length };
}
