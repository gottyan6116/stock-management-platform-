import type { Market } from "@/types/domain";
import type { InstrumentSearchResult } from "./provider";

const FULLWIDTH_ALNUM_OFFSET = 0xfee0;

/** 全角英数字を半角に変換する（全角"７２０３"→"7203"など）。 */
function toHalfWidthAlnum(input: string): string {
  return input.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - FULLWIDTH_ALNUM_OFFSET)
  );
}

/** 検索クエリの正規化: 前後空白除去 + 全角英数字の半角化 + 連続空白の圧縮。 */
export function normalizeSearchQuery(raw: string): string {
  return toHalfWidthAlnum(raw).trim().replace(/\s+/g, " ");
}

/** Provider symbolの正規化: 大文字化 + 前後空白除去。 */
export function normalizeProviderSymbol(raw: string): string {
  return toHalfWidthAlnum(raw).trim().toUpperCase();
}

/** 日本株の4桁コード入力に対して、Yahoo Finance形式の`.T`候補シンボルを生成する。 */
export function generateJapaneseTickerCandidates(query: string): string[] {
  const normalized = normalizeSearchQuery(query);
  if (/^\d{4}$/.test(normalized)) {
    return [`${normalized}.T`];
  }
  return [];
}

/** Provider symbolから市場を判定する（MVP対象の日本株/米国株のみ）。 */
export function detectMarketFromProviderSymbol(providerSymbol: string): Market {
  return normalizeProviderSymbol(providerSymbol).endsWith(".T") ? "JP" : "US";
}

/** 表示用シンボル（画面表示コード）を導出する。日本株は`.T`を除いた4桁コード。 */
export function toDisplaySymbol(providerSymbol: string): string {
  const normalized = normalizeProviderSymbol(providerSymbol);
  return normalized.endsWith(".T") ? normalized.slice(0, -2) : normalized;
}

/** (market, providerSymbol)で重複排除する。先に出現した要素を優先する。 */
export function dedupeSearchResults(results: InstrumentSearchResult[]): InstrumentSearchResult[] {
  const seen = new Set<string>();
  const deduped: InstrumentSearchResult[] = [];

  for (const result of results) {
    const key = `${result.market}:${normalizeProviderSymbol(result.providerSymbol)}`;
    if (seen.has(key)) continue;
    if (result.name.trim().length === 0) continue;
    seen.add(key);
    deduped.push(result);
  }

  return deduped;
}
