import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function mockApis(positions: unknown[], fx: { usdJpy: number; asOf: string } | null, snapshots: unknown[] = [], purchases: unknown[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/fx/usdjpy")) return { ok: true, json: async () => ({ data: fx }) };
      if (url.includes("/api/purchases")) return { ok: true, json: async () => ({ data: purchases }) };
      if (url.includes("/api/snapshots")) return { ok: true, json: async () => ({ data: snapshots }) };
      return { ok: true, json: async () => ({ data: positions }) };
    })
  );
}

function callsTo(path: string, method?: string) {
  const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  return fetchMock.mock.calls.filter(
    ([url, init]) => String(url).includes(path) && (method ? init?.method === method : true)
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

  it("records today's snapshot once when none exists, and never sends amounts from the client", async () => {
    mockApis([stock], { usdJpy: 150, asOf: "2026-09-29T03:00:00Z" }, []);
    renderHome();
    await screen.findByRole("region", { name: "総資産（円換算）" });

    await waitFor(() => expect(callsTo("/api/snapshots", "POST")).toHaveLength(1));
    expect(callsTo("/api/snapshots", "POST")[0]![1]).toEqual({ method: "POST" });
  });

  it("does not record again when today's snapshot already exists", async () => {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
    mockApis([stock], { usdJpy: 150, asOf: "x" }, [
      { date: today, totalValueJpy: 1200, totalCostJpy: null, isEstimated: false },
    ]);
    renderHome();
    await screen.findByRole("region", { name: "総資産（円換算）" });
    await new Promise((r) => setTimeout(r, 50));
    expect(callsTo("/api/snapshots", "POST")).toHaveLength(0);
  });

  it("does not record while USD cannot be converted (would store a falsely low total)", async () => {
    mockApis([stock, usStock], null, []);
    renderHome();
    await screen.findByRole("region", { name: "総資産（円換算）" });
    await new Promise((r) => setTimeout(r, 50));
    expect(callsTo("/api/snapshots", "POST")).toHaveLength(0);
  });

  it("asks for purchase records instead of showing 0 yen used when none are recorded this year", async () => {
    mockApis([stock, fund], { usdJpy: 150, asOf: "x" }, [], []);
    renderHome();

    const nisa = await screen.findByRole("region", { name: "NISA枠" });
    expect(within(nisa).getByText(/買付が未記録のため、消化額は表示できません/)).toBeInTheDocument();
    // 生涯枠は簿価（取得単価×数量）から出せる: 成長=10株×100円、つみたて=100,000口×3円/万口相当
    expect(within(nisa).getByRole("progressbar", { name: "合計の使用率" })).toBeInTheDocument();
    expect(within(nisa).getByRole("button", { name: "買付を記録" })).toBeInTheDocument();
  });

  it("shows annual usage per account and the remaining amount once purchases are recorded", async () => {
    const year = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 4);
    mockApis([stock, fund], { usdJpy: 150, asOf: "x" }, [], [
      { id: "a", instrumentId: "i-fund", name: "テストファンド", nisaType: "tsumitate", side: "buy", tradedOn: `${year}-01-05`, quantity: null, amountJpy: 100_000 },
      { id: "b", instrumentId: "i-stock", name: "トヨタ自動車", nisaType: "growth", side: "buy", tradedOn: `${year}-01-06`, quantity: null, amountJpy: 500_000 },
    ]);
    renderHome();

    const nisa = await screen.findByRole("region", { name: "NISA枠" });
    expect(await within(nisa).findByText("残り ¥1,100,000")).toBeInTheDocument();
    expect(within(nisa).getByText("残り ¥1,900,000")).toBeInTheDocument();
  });

  it("hides the NISA card when nothing is held in a NISA account", async () => {
    mockApis([{ ...stock, nisaType: null }], { usdJpy: 150, asOf: "x" });
    renderHome();
    await screen.findByRole("region", { name: "総資産（円換算）" });
    expect(screen.queryByRole("region", { name: "NISA枠" })).not.toBeInTheDocument();
  });
});
