import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeDashboard } from "@/components/home/HomeDashboard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const stock = {
  id: "s1",
  instrumentId: "i-stock",
  quantity: 10,
  avgCost: 100,
  nisaType: "growth",
  isManual: false,
  providerSymbol: "7203.T",
  displaySymbol: "7203",
  name: "トヨタ自動車",
  exchange: "TSE",
  market: "JP",
  currency: "JPY",
  instrumentType: "stock",
  assetClass: "jp_stock",
  priceDate: "2026-09-29",
  fetchedAt: "2026-09-29T03:00:00Z",
  displayPrice: 120,
  unitDivisor: 1,
  lastClose: 120,
  change: 2,
  changePercent: 1.7,
};

const usStock = {
  ...stock,
  id: "u1",
  instrumentId: "i-us",
  providerSymbol: "HPQ",
  displaySymbol: "HPQ",
  name: "HP Inc.",
  market: "US",
  currency: "USD",
  assetClass: "us_stock",
  nisaType: null,
  quantity: 2,
  avgCost: 40,
  displayPrice: 30,
  lastClose: 30,
  change: 0.5,
};

const fund = {
  ...stock,
  id: "f1",
  instrumentId: "i-fund",
  providerSymbol: "MANUAL:fund",
  displaySymbol: "fund",
  name: "テストファンド",
  instrumentType: "fund",
  assetClass: "fund",
  isManual: true,
  nisaType: "tsumitate",
  quantity: 100000,
  avgCost: 3,
  displayPrice: 40000,
  unitDivisor: 10000,
  lastClose: 4,
  priceDate: "2026-07-07",
  change: null,
  changePercent: null,
};

function mockApis(positions: unknown[], fx: { usdJpy: number; asOf: string } | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/fx/usdjpy")) return { ok: true, json: async () => ({ data: fx }) };
      return { ok: true, json: async () => ({ data: positions }) };
    })
  );
}

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HomeDashboard />
    </QueryClientProvider>
  );
}

describe("HomeDashboard (Phase 2)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows total assets in yen with USD converted, and notes the rate used", async () => {
    mockApis([stock, usStock], { usdJpy: 150, asOf: "2026-09-29T03:00:00Z" });
    renderHome();

    const total = await screen.findByRole("region", { name: "総資産（円換算）" });
    // 10株×¥120 + 2株×$30×150 = 1,200 + 9,000
    expect(within(total).getByText("¥10,200")).toBeInTheDocument();
    expect(within(total).getByText(/USD保有 \$60\.00 を 1ドル=150円で換算/)).toBeInTheDocument();
    // 含み損益: (10,200) - (1,000 + 2×40×150=12,000) = -2,800
    expect(within(total).getByText(/−¥2,800/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "ホーム" })).toBeInTheDocument();
  });

  it("does not assume an exchange rate: USD is left out and the reason is stated", async () => {
    mockApis([stock, usStock], null);
    renderHome();

    const total = await screen.findByRole("region", { name: "総資産（円換算）" });
    expect(within(total).getByText("¥1,200")).toBeInTheDocument();
    expect(within(total).getByText(/為替レートを取得できないため/)).toBeInTheDocument();
  });

  it("allocates by market value (not by count) and switches between account and asset class", async () => {
    mockApis([stock, fund], { usdJpy: 150, asOf: "2026-09-29T03:00:00Z" });
    renderHome();

    const allocation = await screen.findByRole("region", { name: "資産配分（評価額ベース）" });
    // 口座: つみたて ¥400,000 (fund) vs 成長 ¥1,200
    expect(within(allocation).getByText("つみたて投資枠")).toBeInTheDocument();
    expect(within(allocation).getByText("99.7%")).toBeInTheDocument();

    fireEvent.click(within(allocation).getByRole("button", { name: "資産クラス" }));
    expect(within(allocation).getByText("投資信託")).toBeInTheDocument();
    expect(within(allocation).getByText("日本株")).toBeInTheDocument();
    expect(within(allocation).queryByText("つみたて投資枠")).not.toBeInTheDocument();
  });

  it("lists stale fund NAVs under 要対応 and opens the update dialog", async () => {
    mockApis([stock, fund], { usdJpy: 150, asOf: "2026-09-29T03:00:00Z" });
    renderHome();

    const actions = await screen.findByRole("region", { name: "要対応" });
    expect(within(actions).getByText("投資信託の基準価額が未更新（1本）")).toBeInTheDocument();

    fireEvent.click(within(actions).getByRole("button", { name: /更新/ }));
    expect(await screen.findByRole("dialog", { name: "基準価額を更新" })).toBeInTheDocument();
  });

  it("says nothing needs attention when there is nothing to do", async () => {
    mockApis([stock], { usdJpy: 150, asOf: "2026-09-29T03:00:00Z" });
    renderHome();
    const actions = await screen.findByRole("region", { name: "要対応" });
    expect(within(actions).getByText("対応事項はありません")).toBeInTheDocument();
  });

  it("keeps a single global search in the header, none on the page, and offers registration when empty", async () => {
    mockApis([], null);
    renderHome();

    expect(await screen.findByRole("link", { name: "保有資産を登録する" })).toHaveAttribute("href", "/portfolio");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
