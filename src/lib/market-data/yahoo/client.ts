import "server-only";
import YahooFinance from "yahoo-finance2";

/**
 * yahoo-finance2はサーバー専用（`server-only` import）。ブラウザから直接importされた場合は
 * ビルドエラーになる。プロセス内でシングルトンとして再利用する。
 */
type YahooFinanceClient = InstanceType<typeof YahooFinance>;

let instance: YahooFinanceClient | null = null;

export function getYahooClient(): YahooFinanceClient {
  if (!instance) {
    instance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
  }
  return instance;
}
