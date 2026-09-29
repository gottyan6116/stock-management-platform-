import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PercentChange } from "@/components/tables/PercentChange";

describe("PercentChange (0-4: 円の損益は整数表示)", () => {
  it("rounds a yen profit amount to a whole number", () => {
    render(<PercentChange amount={455613.37} percent={79.37} kind="amount" currency="JPY" />);
    expect(screen.getByText("+455,613")).toBeInTheDocument();
  });

  it("keeps decimals for price changes such as a ¥2.5 daily move", () => {
    render(<PercentChange amount={2.5} percent={0.21} />);
    expect(screen.getByText("+2.5")).toBeInTheDocument();
  });

  it("keeps two decimals for USD amounts", () => {
    render(<PercentChange amount={-16.3} percent={-15.14} kind="amount" currency="USD" />);
    expect(screen.getByText("-16.3")).toBeInTheDocument();
  });
});
