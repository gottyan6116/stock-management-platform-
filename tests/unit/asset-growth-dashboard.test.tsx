import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppTopBar } from "@/components/app-shell/AppTopBar";
import { AssetGrowthDashboard } from "@/components/home/AssetGrowthDashboard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const profitablePosition = {
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
      <AssetGrowthDashboard />
    </QueryClientProvider>
  );
}

function mockPositions(data: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data }),
    })
  );
}

describe("AssetGrowthDashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_ENABLE_SAMPLE_RESEARCH;
  });

  it("shows profitable portfolio status and labels sample research", async () => {
    process.env.NEXT_PUBLIC_ENABLE_SAMPLE_RESEARCH = "true";
    mockPositions([profitablePosition]);

    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "資産全体の現在地" }, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(screen.getByText("資産全体はプラス")).toBeInTheDocument();
    expect(screen.getByText("+¥200.0")).toBeInTheDocument();
    expect(screen.getAllByText("サンプル").length).toBeGreaterThan(0);
    expect(screen.getByText("見直し候補（サンプル）")).toBeInTheDocument();
    expect(screen.getByText("根拠の充実度（サンプル）")).toBeInTheDocument();
    expect(screen.getByText("ポートフォリオのプラス可能性（サンプル）")).toBeInTheDocument();
    expect(screen.getByText("下落リスク（サンプル）")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(
      screen.getAllByText(/サンプル · 表示確認用の固定サンプル · sample-v1 · 更新 /).length
    ).toBeGreaterThan(0);
    const portfolioStatus = screen
      .getByRole("heading", { name: "資産全体の現在地" })
      .closest("section");
    expect(portfolioStatus).not.toBeNull();
    expect(
      within(portfolioStatus as HTMLElement).getByText(
        /サンプル · 表示確認用の固定サンプル · sample-v1 · 更新 2026-08-16 09:00/
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "予測に使った情報" })).toBeInTheDocument();
  });

  it("does not expose sample scores when sample research is disabled", async () => {
    mockPositions([profitablePosition]);

    renderDashboard();

    expect(await screen.findByText("分析データがまだありません")).toBeInTheDocument();
    expect(screen.queryByText(/サンプル/)).not.toBeInTheDocument();
    expect(screen.queryByText("58%")).not.toBeInTheDocument();
    expect(screen.queryByText("33%")).not.toBeInTheDocument();

    const metrics = screen.getByRole("list", { name: "資産全体の現在地" });
    expect(within(metrics).getByText("ポートフォリオのプラス可能性")).toBeInTheDocument();
    expect(within(metrics).getByText("下落リスク")).toBeInTheDocument();
    expect(within(metrics).getAllByText("未接続")).toHaveLength(2);
  });

  it("labels mixed missing valuation and cost data as partially calculated", async () => {
    mockPositions([
      profitablePosition,
      {
        ...profitablePosition,
        id: "p2",
        providerSymbol: "AAPL",
        displaySymbol: "AAPL",
        market: "US",
        currency: "USD",
        lastClose: null,
      },
    ]);

    renderDashboard();

    expect(await screen.findByText("一部未計算")).toBeInTheDocument();
    expect(screen.queryByText("資産全体はプラス")).not.toBeInTheDocument();
    expect(screen.getByText("USD 評価額（一部未計算）")).toBeInTheDocument();
    expect(screen.getByText("USD 含み損益（一部未計算）")).toBeInTheDocument();
  });

  it("states that the five-year outlook is unavailable without a generic sample badge", async () => {
    process.env.NEXT_PUBLIC_ENABLE_SAMPLE_RESEARCH = "true";
    mockPositions([profitablePosition]);

    renderDashboard();
    await screen.findByRole("heading", { name: "資産全体の現在地" });
    fireEvent.click(screen.getByRole("button", { name: "5年" }));

    const holdings = screen.getByRole("region", { name: "保有銘柄の見通し" });
    expect(within(holdings).getByText("5年の見通しは未提供")).toBeInTheDocument();
    expect(within(holdings).queryByText("サンプル")).not.toBeInTheDocument();

    const metrics = screen.getByRole("list", { name: "資産全体の現在地" });
    expect(within(metrics).getAllByText("未提供")).toHaveLength(2);
  });

  it("shows a truthful stock and fund count composition without presenting markets as allocation", async () => {
    mockPositions([
      profitablePosition,
      {
        ...profitablePosition,
        id: "p2",
        providerSymbol: "manual-fund",
        displaySymbol: "manual-fund",
        name: "手入力ファンド",
        instrumentType: "fund",
        isManual: true,
      },
    ]);

    renderDashboard();

    const composition = await screen.findByRole("region", {
      name: "保有内訳（銘柄数ベース）",
    });
    expect(within(composition).getByText("株式 1")).toBeInTheDocument();
    expect(within(composition).getByText("投資信託 1")).toBeInTheDocument();
    expect(within(composition).getByText(/評価額や通貨を合算せず/)).toBeInTheDocument();
    expect(within(composition).queryByText(/日本株|米国株/)).not.toBeInTheDocument();
  });

  it("keeps stock search and the position-management action available for an empty portfolio", async () => {
    mockPositions([]);

    renderDashboard();

    expect(await screen.findByRole("combobox", { name: "銘柄検索" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "見通し期間" })).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "保有資産を登録する" })).toHaveAttribute(
      "href",
      "/portfolio"
    );
    expect(screen.queryByRole("heading", { name: "資産全体の現在地" })).not.toBeInTheDocument();
  });
});

describe("AppTopBar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the latest fetchedAt from the shared positions query", async () => {
    mockPositions([
      profitablePosition,
      { ...profitablePosition, id: "p2", fetchedAt: "2026-08-16T01:30:00Z" },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <AppTopBar />
      </QueryClientProvider>
    );

    expect(
      await screen.findByRole("status", { name: "最終取得 2026-08-16 10:30" })
    ).toBeInTheDocument();
    expect(screen.getByText("08/16 10:30")).toHaveClass("sm:hidden");
  });

  it("shows an unfetched state when the positions response has no timestamps", async () => {
    mockPositions([]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <AppTopBar />
      </QueryClientProvider>
    );

    expect(await screen.findByText("最終取得 未取得")).toBeInTheDocument();
  });
});
