import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceCoveragePanel } from "@/components/research/EvidenceCoveragePanel";

describe("EvidenceCoveragePanel", () => {
  it("shows that evidence is sample data", () => {
    render(<EvidenceCoveragePanel dataKind="sample" evidence={[]} />);

    expect(screen.getByText("サンプル")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "予測に使った情報" })).toBeInTheDocument();
  });

  it("shows an explicit unavailable state without a sample label", () => {
    render(<EvidenceCoveragePanel dataKind="unavailable" evidence={[]} />);

    expect(screen.getByText("分析データがまだありません")).toBeInTheDocument();
    expect(screen.queryByText("サンプル")).not.toBeInTheDocument();
  });

  it("renders evidence categories and their freshness status", () => {
    render(
      <EvidenceCoveragePanel
        dataKind="sample"
        evidence={[
          { category: "prices", status: "current" },
          { category: "orderBook", status: "stale" },
          { category: "events", status: "missing" },
        ]}
      />
    );

    expect(screen.getByText("過去株価・チャート")).toBeInTheDocument();
    expect(screen.getByText("更新済み")).toBeInTheDocument();
    expect(screen.getByText("要更新")).toBeInTheDocument();
    expect(screen.getByText("未接続")).toBeInTheDocument();
  });

  it("renders categories as flat divided rows instead of nested cards", () => {
    render(
      <EvidenceCoveragePanel
        dataKind="sample"
        evidence={[
          { category: "prices", status: "current" },
          { category: "financials", status: "missing" },
        ]}
      />
    );

    expect(screen.getByRole("list")).toHaveClass("divide-y");
    for (const row of screen.getAllByRole("listitem")) {
      expect(row).not.toHaveClass("rounded-card");
      expect(row).not.toHaveClass("border");
      expect(row).not.toHaveClass("bg-surface-subtle");
    }
  });
});
