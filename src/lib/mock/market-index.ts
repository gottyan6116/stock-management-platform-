import type { DailyPrice, Quote } from "@/types/domain";
import { generateMockDailySeries } from "./series";

const TODAY = new Date().toISOString().slice(0, 10);
const FETCHED_AT = new Date().toISOString();

export function buildMockIndexSeries(key: string, basePrice: number) {
  const daily: DailyPrice[] = generateMockDailySeries(key, 260 * 10, basePrice);
  const last = daily[daily.length - 1]!;
  const prev = daily[daily.length - 2]!;
  const change = last.close! - prev.close!;
  const changePercent = (change / prev.close!) * 100;

  const quote: Quote = {
    instrumentId: key,
    priceDate: TODAY,
    fetchedAt: FETCHED_AT,
    close: last.close,
    previousClose: prev.close,
    change,
    changePercent,
    dividendYield: null,
    marketCap: null,
    trailingPE: null,
  };

  return { quote, dailyPrices: daily };
}
