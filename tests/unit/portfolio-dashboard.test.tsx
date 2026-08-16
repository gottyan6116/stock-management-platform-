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
  priceDate: "2026-08-15",
  fetchedAt: "2026-08-16T00:00:00Z",
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
    mockPositionRequests([position, { ...position, id: "p2", lastClose: null }]);
    renderDashboard();

    expect(await screen.findByText("評価額（一部未計算）")).toBeInTheDocument();
    expect(screen.getByText("評価損益（概算・一部未計算）")).toBeInTheDocument();
  });
});
