import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalyticsPanel } from "@/components/ui/AnalyticsPanel";
import { SegmentedMetric, SegmentedMetricStrip } from "@/components/ui/SegmentedMetricStrip";

describe("analytics primitives", () => {
  it("exposes a named analytics region", () => {
    render(<AnalyticsPanel title="資産配分">内容</AnalyticsPanel>);
    expect(screen.getByRole("region", { name: "資産配分" })).toBeInTheDocument();
  });

  it("renders connected metrics as a list", () => {
    render(
      <SegmentedMetricStrip ariaLabel="資産全体の現在地">
        <SegmentedMetric label="評価額" value="¥4,000,000" />
        <SegmentedMetric label="評価損益" value="+¥400,000" />
      </SegmentedMetricStrip>
    );
    expect(screen.getByRole("list", { name: "資産全体の現在地" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
