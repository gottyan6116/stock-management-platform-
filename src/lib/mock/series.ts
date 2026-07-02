import type { DailyPrice } from "@/types/domain";

// 決定論的な疑似乱数（Mulberry32）。Phase 1 のUIモックにのみ使用し、本番データには使わない。
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return h;
}

/** 指定シンボル・日数分の疑似日足OHLCVを、開始基準価格から生成する。 */
export function generateMockDailySeries(
  symbol: string,
  tradingDays: number,
  basePrice: number
): DailyPrice[] {
  const random = mulberry32(hashSeed(symbol));
  const prices: DailyPrice[] = [];
  let close = basePrice;
  const today = new Date();
  let cursor = new Date(today);
  cursor.setDate(cursor.getDate() - Math.ceil((tradingDays * 7) / 5));

  while (prices.length < tradingDays) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      const drift = 0.0001;
      const volatility = 0.014;
      const changePct = drift + (random() - 0.5) * volatility;
      const open = close;
      close = Math.max(open * (1 + changePct), 0.01);
      const high = Math.max(open, close) * (1 + random() * 0.006);
      const low = Math.min(open, close) * (1 - random() * 0.006);
      const volume = Math.floor(1_000_000 + random() * 5_000_000);

      prices.push({
        tradingDate: cursor.toISOString().slice(0, 10),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        adjustedClose: Number(close.toFixed(2)),
        volume,
      });
    }
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }

  return prices;
}
