import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssetHistoryChart } from "@/components/charts/AssetHistoryChart";

const p = (date: string, totalValueJpy: number, isEstimated = false) => ({
  date,
  totalValueJpy,
  totalCostJpy: null,
  isEstimated,
});

describe("AssetHistoryChart", () => {
  it("explains that recording has just started instead of drawing an empty chart", () => {
    render(<AssetHistoryChart points={[p("2026-09-30", 3_600_000)]} />);
    expect(screen.getByText(/2026-09-30 から記録を始めました/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("tells the user how recording works when there is no data", () => {
    render(<AssetHistoryChart points={[]} />);
    expect(screen.getByText(/毎日自動で記録/)).toBeInTheDocument();
  });

  it("draws solid lines for recorded days and dashed lines only for estimated periods", () => {
    const { container } = render(
      <AssetHistoryChart points={[p("2026-09-28", 100, true), p("2026-09-29", 110, true), p("2026-09-30", 120)]} />
    );
    expect(screen.getByRole("img", { name: /2026-09-28.*2026-09-30/ })).toBeInTheDocument();
    const paths = [...container.querySelectorAll("path")];
    expect(paths).toHaveLength(2);
    expect(paths[0]!.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(paths[1]!.getAttribute("stroke-dasharray")).toBeTruthy(); // 推計→実測の接続区間も破線
    expect(screen.getByText("破線は実測ではなく推計の期間です。")).toBeInTheDocument();
  });

  it("uses no dashes and no legend when every point is recorded", () => {
    const { container } = render(<AssetHistoryChart points={[p("2026-09-29", 100), p("2026-09-30", 120)]} />);
    expect(container.querySelector("path")!.getAttribute("stroke-dasharray")).toBeNull();
    expect(screen.queryByText(/破線/)).not.toBeInTheDocument();
  });
});
