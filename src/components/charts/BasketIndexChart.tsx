"use client";

import { useEffect, useRef } from "react";
import { ColorType, createChart, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { BasketIndexPoint } from "@/lib/aggregation/basket-index";
import { ChartEmptyState } from "./ChartEmptyState";

function toTimestamp(dateStr: string): UTCTimestamp {
  return (new Date(`${dateStr}T00:00:00Z`).getTime() / 1000) as UTCTimestamp;
}

export function BasketIndexChart({ points }: { points: BasketIndexPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || container.clientWidth === 0 || points.length === 0) return;

    const chart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#475569" },
      grid: { vertLines: { color: "#e2e8f0" }, horzLines: { color: "#e2e8f0" } },
      timeScale: { borderColor: "#e2e8f0" },
      rightPriceScale: { borderColor: "#e2e8f0" },
      width: container.clientWidth,
      height: 280,
    });
    chartRef.current = chart;

    const series = chart.addLineSeries({ color: "#155eef", lineWidth: 2 });
    series.setData(points.map((p) => ({ time: toTimestamp(p.date), value: Number(p.value.toFixed(2)) })));
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) chart.applyOptions({ width: entry.contentRect.width });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [points]);

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="mb-3 text-lg font-bold text-text-primary">
        お気に入り銘柄の長期推移（開始時点=100）
      </p>
      {points.length === 0 ? <ChartEmptyState /> : <div ref={containerRef} className="h-[280px] w-full" />}
    </div>
  );
}
