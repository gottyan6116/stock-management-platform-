import type { InstrumentType, Market } from "@/types/domain";

/**
 * 資産クラス。instruments.market は JP/US の2値しか持てず、手入力の投資信託は
 * 「JP」で保存されている（Phase 0-2: 投資信託が日本株の区分・比率に混入していた原因）。
 * market から株式の区分を推測するのではなく、instrument_type と組み合わせた
 * 独立した属性として1か所で導出し、フィルタ・比率・バッジはすべてこれを使う。
 */
export type AssetClass = "fund" | "jp_stock" | "us_stock";

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  fund: "投資信託",
  jp_stock: "日本株",
  us_stock: "米国株",
};

// 表示・小計の並び順（投資信託が資産の大半を占めるため先頭）。
export const ASSET_CLASS_ORDER: readonly AssetClass[] = ["fund", "jp_stock", "us_stock"];

export function getAssetClass(instrument: { instrumentType: InstrumentType; market: Market }): AssetClass {
  if (instrument.instrumentType === "fund") return "fund";
  return instrument.market === "JP" ? "jp_stock" : "us_stock";
}

/** 投資信託の基準価額は「1万口あたり」で表示される慣行。評価額＝口数×基準価額÷10,000。 */
export const FUND_UNIT_DIVISOR = 10000;
