"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorType,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChartInterval, ChartMode, ChartRange, DailyPrice } from "@/types/domain";
import { aggregateMonthly, aggregateWeekly } from "@/lib/aggregation/aggregate";
import { filterByRange } from "@/lib/aggregation/range";
import { ChartToolbar } from "./ChartToolbar";
import { ChartEmptyState } from "./ChartEmptyState";

function toTimestamp(dateStr: string): UTCTimestamp {
  return (new Date(`${dateStr}T00:00:00Z`).getTime() / 1000) as UTCTimestamp;
}

export function PriceChart({
  dailyPrices,
  title,
  initialInterval = "week",
  initialRange = "3y",
}: {
  dailyPrices: DailyPrice[];
  title?: string;
  initialInterval?: ChartInterval;
  initialRange?: ChartRange;
}) {
  const [interval, setInterval] = useState<ChartInterval>(initialInterval);
  const [range, setRange] = useState<ChartRange>(initialRange);
  const [mode, setMode] = useState<ChartMode>("candlestick");

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | null>(null);

  const aggregated = useMemo(() => {
    const inRange = filterByRange(dailyPrices, range);
    return interval === "week" ? aggregateWeekly(inRange) : aggregateMonthly(inRange);
  }, [dailyPrices, interval, range]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || container.clientWidth === 0) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#475569",
      },
      grid: {
        vertLines: { color: "#e2e8f0" },
        horzLines: { color: "#e2e8f0" },
      },
      crosshair: { mode: 0 },
      timeScale: { borderColor: "#e2e8f0" },
      rightPriceScale: { borderColor: "#e2e8f0" },
      width: container.clientWidth,
      height: 320,
    });
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) chart.applyOptions({ width: entry.contentRect.width });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // チャートインスタンス自体はマウント時に1度だけ生成する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    if (mode === "candlestick") {
      const series = chart.addCandlestickSeries({
        upColor: "#15803d",
        downColor: "#dc2626",
        borderVisible: false,
        wickUpColor: "#15803d",
        wickDownColor: "#dc2626",
      });
      const data: CandlestickData[] = aggregated
        .filter((row) => row.open !== null && row.high !== null && row.low !== null && row.close !== null)
        .map((row) => ({
          time: toTimestamp(row.tradingDate),
          open: row.open!,
          high: row.high!,
          low: row.low!,
          close: row.close!,
        }));
      series.setData(data);
      seriesRef.current = series;
    } else {
      const series = chart.addLineSeries({ color: "#155eef", lineWidth: 2 });
      const data: LineData[] = aggregated
        .filter((row) => row.adjustedClose !== null)
        .map((row) => ({ time: toTimestamp(row.tradingDate), value: row.adjustedClose! }));
      series.setData(data);
      seriesRef.current = series;
    }

    chart.timeScale().fitContent();
  }, [aggregated, mode]);

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {title ? <p className="text-lg font-bold text-text-primary">{title}</p> : <span />}
        <ChartToolbar
          interval={interval}
          onIntervalChange={setInterval}
          range={range}
          onRangeChange={setRange}
          mode={mode}
          onModeChange={setMode}
        />
      </div>
      {aggregated.length === 0 ? (
        <ChartEmptyState />
      ) : (
        <div ref={containerRef} className="h-[320px] w-full" />
      )}
    </div>
  );
}
