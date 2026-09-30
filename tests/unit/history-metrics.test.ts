import { describe, expect, it } from "vitest";
import { computeReturn1y, toSparkline } from "@/lib/pricing/history-metrics";

function series(count: number, valueAt: (i: number) => number) {
  return Array.from({ length: count }, (_, i) => ({
    tradingDate: `d${i}`,
    close: valueAt(i),
    adjustedClose: valueAt(i),
  }));
}

describe("computeReturn1y", () => {
  it("compares the latest adjusted close with the one about a year (252 trading days) earlier", () => {
    // 300 days rising 1 per day starting at 100: latest 399, one year earlier index 300-1-252=47 -> 147
    const prices = series(300, (i) => 100 + i);
    expect(computeReturn1y(prices)).toBeCloseTo(((399 - 147) / 147) * 100, 6);
  });

  it("returns null (not 0) when there is less than about a year of history", () => {
    expect(computeReturn1y(series(100, (i) => 100 + i))).toBeNull();
  });

  it("returns null when prices are missing", () => {
    expect(computeReturn1y([])).toBeNull();
  });
});

describe("toSparkline", () => {
  it("downsamples to at most the requested number of points and keeps the latest value last", () => {
    const line = toSparkline(series(260, (i) => i + 1), 52);
    expect(line.length).toBeLessThanOrEqual(52);
    expect(line[line.length - 1]).toBe(260);
  });

  it("returns an empty array when there are no prices", () => {
    expect(toSparkline([], 52)).toEqual([]);
  });
});
