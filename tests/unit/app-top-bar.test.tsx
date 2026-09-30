import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppTopBar } from "@/components/app-shell/AppTopBar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const position = {
  id: "p1",
  instrumentId: "i1",
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

function mockPositions(data: unknown[]) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) }));
}

function renderTopBar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AppTopBar />
    </QueryClientProvider>
  );
}

describe("AppTopBar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the latest price update time in JST from the shared positions query", async () => {
    mockPositions([position, { ...position, id: "p2", fetchedAt: "2026-08-16T01:30:00Z" }]);
    renderTopBar();

    expect(await screen.findByRole("status", { name: "価格更新 2026-08-16 10:30 JST" })).toBeInTheDocument();
    expect(screen.getByText("08/16 10:30 JST")).toHaveClass("sm:hidden");
  });

  it("shows an unfetched state when the positions response has no timestamps", async () => {
    mockPositions([]);
    renderTopBar();
    expect(await screen.findByText("価格更新 未取得")).toBeInTheDocument();
  });

  it("holds the single global search and no duplicated tagline or settings shortcut (Phase 1)", async () => {
    mockPositions([]);
    renderTopBar();

    expect(await screen.findAllByRole("combobox", { name: "銘柄検索" })).toHaveLength(1);
    expect(screen.queryByText("長期投資インテリジェンス")).not.toBeInTheDocument();
    expect(screen.queryByText("判断材料を一か所で確認")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "設定を開く" })).not.toBeInTheDocument();
  });
});
