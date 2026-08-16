import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResearchOutlookPanel } from "@/components/research/ResearchOutlookPanel";
import { getResearchOutlook } from "@/features/research/sample-outlooks";

describe("ResearchOutlookPanel", () => {
  it("shows benchmark probability, a range, and sample provenance next to the forecast", () => {
    render(<ResearchOutlookPanel outlook={getResearchOutlook("7203.T")} />);

    expect(screen.getAllByText("比較指数を上回る可能性")).toHaveLength(2);
    expect(screen.getByText("54%")).toBeInTheDocument();
    expect(screen.getAllByText("想定リターン範囲")).toHaveLength(2);
    expect(screen.getByText("-12%〜+18%")).toBeInTheDocument();
    expect(
      screen.getByText(/サンプル · 表示確認用の固定サンプル · sample-v1 · 更新 /)
    ).toBeInTheDocument();
  });

  it("keeps an unknown symbol neutral and states when range and update time are unavailable", () => {
    render(<ResearchOutlookPanel outlook={getResearchOutlook("UNKNOWN")} />);

    expect(screen.getAllByText("50%").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("未算出")).toHaveLength(2);
    expect(screen.getByText(/更新時刻なし/)).toBeInTheDocument();
    expect(screen.getByText("銘柄固有の分析データはまだありません。")).toBeInTheDocument();
    expect(screen.queryByText(/長期見通しの表示例/)).not.toBeInTheDocument();
  });
});
