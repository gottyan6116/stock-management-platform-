import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortfolioDashboard } from "@/components/portfolio/PortfolioDashboard";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

const position = {
  id: "p1",
  quantity: 10,
  avgCost: 100,
  nisaType: null,
  isManual: false,
  providerSymbol: "7203.T",
  displaySymbol: "7203",
  name: "トヨタ自動車",
  exchange: "TSE",
  market: "JP",
  currency: "JPY",
  instrumentType: "stock",
  assetClass: "jp_stock",
  priceDate: "2026-08-15",
  fetchedAt: "2026-08-16T00:00:00Z",
  displayPrice: 120,
  unitDivisor: 1,
  lastClose: 120,
  change: 2,
  changePercent: 1.7,
};

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PortfolioDashboard />
    </QueryClientProvider>
  );
}

function mockPositionRequests(data: unknown[]) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "DELETE") {
      return { ok: true, json: async () => ({ data: null }) };
    }
    return { ok: true, json: async () => ({ data }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("PortfolioDashboard position actions", () => {
  beforeEach(() => mocks.push.mockReset());

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses native detail links for desktop and mobile and keeps delete independent", async () => {
    const fetchMock = mockPositionRequests([position]);
    renderDashboard();

    const detailLinks = await screen.findAllByRole("link", { name: /トヨタ自動車/ });
    expect(detailLinks).toHaveLength(2);
    for (const link of detailLinks) {
      expect(link).toHaveAttribute("href", "/stocks/7203.T");
      expect(link.tagName).toBe("A");
      expect(link).toHaveClass("focus-visible:ring-2");
    }

    const deleteButtons = screen.getAllByRole("button", { name: /削除/ });
    expect(deleteButtons).toHaveLength(2);
    for (const button of deleteButtons) {
      expect(button).toHaveClass("min-h-11");
      expect(button).toHaveClass("min-w-11");
      expect(button).toHaveClass("focus-visible:ring-2");
    }

    fireEvent.click(deleteButtons[0]!);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/positions/p1", { method: "DELETE" })
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("labels portfolio-page totals when valuation and profit coverage are partial", async () => {
    mockPositionRequests([position, { ...position, id: "p2", displayPrice: null, lastClose: null }]);
    renderDashboard();

    expect(await screen.findByText("評価額（一部未計算）")).toBeInTheDocument();
    expect(screen.getByText("評価損益（概算・一部未計算）")).toBeInTheDocument();
  });

  it("keeps the add-position form off the page until the button opens it in a dialog (Phase 1)", async () => {
    mockPositionRequests([position]);
    renderDashboard();

    await screen.findAllByRole("link", { name: /トヨタ自動車/ });
    expect(screen.getByRole("heading", { level: 1, name: "保有資産" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("保有数量")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /保有を追加/ }));
    const dialog = await screen.findByRole("dialog", { name: "保有を追加" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText("保有数量")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("filters by asset class so funds (stored with market=JP) never appear under 日本株 (regression 0-2)", async () => {
    const fund = {
      ...position,
      id: "f1",
      providerSymbol: "MANUAL:fund",
      displaySymbol: "fund",
      name: "テストファンド",
      market: "JP",
      instrumentType: "fund",
      assetClass: "fund",
      isManual: true,
      displayPrice: 38532,
      unitDivisor: 10000,
      lastClose: 3.8532,
      quantity: 267218,
    };
    mockPositionRequests([position, fund]);
    renderDashboard();
    await screen.findAllByRole("link", { name: /トヨタ自動車/ });

    fireEvent.click(screen.getByRole("tab", { name: "日本株" }));
    expect(screen.getAllByRole("link", { name: /トヨタ自動車/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /テストファンド/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "投資信託" }));
    expect(screen.getAllByRole("link", { name: /テストファンド/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /トヨタ自動車/ })).not.toBeInTheDocument();
    // 基準価額は1万口あたり、評価額は口数×基準価額÷10,000
    expect(screen.getAllByText("¥38,532").length).toBeGreaterThan(0);
    expect(screen.getAllByText("¥1,029,644").length).toBeGreaterThan(0);
  });
});
