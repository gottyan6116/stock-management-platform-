/**
 * 日本語の通称・カタカナ表記からProvider symbolを解決するための別名辞書。
 * Yahoo Financeの検索は英語名・ティッカーのみを理解するため、代表的な大型株について
 * 日本語検索でもヒットするようここで補完する。必要に応じて追加してよい。
 */
export const COMPANY_ALIASES: Record<string, string[]> = {
  AAPL: ["アップル", "アップル社"],
  MSFT: ["マイクロソフト"],
  GOOGL: ["グーグル", "アルファベット"],
  AMZN: ["アマゾン", "アマゾンドットコム"],
  META: ["メタ", "フェイスブック"],
  NVDA: ["エヌビディア", "エヌビディア社"],
  TSLA: ["テスラ"],
  JNJ: ["ジョンソンアンドジョンソン", "ジョンソン・エンド・ジョンソン", "ジョンソン&ジョンソン"],
  KO: ["コカコーラ", "コカ・コーラ"],
  PG: ["プロクターアンドギャンブル", "プロクター・アンド・ギャンブル", "P&G"],
  DIS: ["ディズニー", "ウォルトディズニー"],
  NKE: ["ナイキ"],
  MCD: ["マクドナルド"],
  SBUX: ["スターバックス"],
  V: ["ビザ"],
  MA: ["マスターカード"],
  JPM: ["ジェイピーモルガン", "JPモルガン"],
  WMT: ["ウォルマート"],
  XOM: ["エクソンモービル"],
  BA: ["ボーイング"],
  IBM: ["アイビーエム"],
  INTC: ["インテル"],
  CSCO: ["シスコ", "シスコシステムズ"],
  ORCL: ["オラクル"],
  NFLX: ["ネットフリックス"],
  ADBE: ["アドビ"],
  CRM: ["セールスフォース"],
  PYPL: ["ペイパル"],
  UBER: ["ウーバー"],
  ABNB: ["エアビーアンドビー", "エアビーエヌビー"],
  "7203.T": ["トヨタ", "トヨタ自動車"],
  "8306.T": ["三菱UFJ", "三菱UFJフィナンシャルグループ"],
  "9984.T": ["ソフトバンクグループ"],
  "7974.T": ["任天堂"],
  "8035.T": ["東京エレクトロン"],
};

/** クエリに部分一致する別名を持つprovider symbolの一覧を返す（重複なし）。 */
export function findAliasedSymbols(query: string): string[] {
  const q = query.trim();
  if (q.length < 2) return [];

  const matched = new Set<string>();
  for (const [symbol, aliases] of Object.entries(COMPANY_ALIASES)) {
    if (aliases.some((alias) => alias.includes(q) || q.includes(alias))) {
      matched.add(symbol);
    }
  }
  return Array.from(matched);
}
