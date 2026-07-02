import type { Market } from "@/types/domain";

export interface WatchlistEntry {
  providerSymbol: string;
  market: Market;
}

// 設計書 14.6 / 15.6: お気に入りが少ない場合に補完表示する「注目銘柄」。
// 本番データではなく設定ファイルとして分離し、お気に入りとは明確に区別する。
export const JAPAN_FEATURED_SYMBOLS: WatchlistEntry[] = [
  { providerSymbol: "7203.T", market: "JP" },
  { providerSymbol: "8306.T", market: "JP" },
  { providerSymbol: "9984.T", market: "JP" },
  { providerSymbol: "8035.T", market: "JP" },
  { providerSymbol: "7974.T", market: "JP" },
];

export const US_FEATURED_SYMBOLS: WatchlistEntry[] = [
  { providerSymbol: "AAPL", market: "US" },
  { providerSymbol: "NVDA", market: "US" },
  { providerSymbol: "MSFT", market: "US" },
  { providerSymbol: "AMZN", market: "US" },
  { providerSymbol: "GOOGL", market: "US" },
];
