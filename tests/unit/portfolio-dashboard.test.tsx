import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortfolioDashboard } from "@/components/portfolio/PortfolioDashboard";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

const position = {
  id: "p1",
  instrumentId: "i-toyota",
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
  fetchedAt: "2026-09-29T00:00:00Z",
  displayPrice: 120,
  unitDivisor: 1,
  lastClose: 120,
  change: 2,
  changePercent: 1.7,
};

const fund = {
  ...position,
  id: "f1",
  instrumentId: "i-fund",
  providerSymbol: "MANUAL:fund",
  displaySymbol: "fund",
  name: "テストファンド",
  market: "JP",
  instrumentType: "fund",
  assetClass: "fund",
  isManual: true,
  nisaType: "tsumitate",
  quantity: 267218,
  avgCost: 2.148175,
  displayPrice: 38532,
  unitDivisor: 10000,
  lastClose: 3.8532,
  priceDate: "2026-09-29",
  change: null,
  changePercent: null,
};

const usStock = {
  ...position,
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
  displayPrice: 31.32,
  lastClose: 31.32,
};

function mockApis(positions: unknown[], fx: { usdJpy: number; asOf: string } | null = { usdJpy: 150, asOf: "x" }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/fx/usdjpy")) return { ok: true, json: async () => ({ data: fx }) };
    if (init?.method === "DELETE" || init?.method === "PATCH") return { ok: true, json: async () => ({ data: {} }) };
    return { ok: true, json: async () => ({ data: positions }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PortfolioDashboard />
    </QueryClientProvider>
  );
}

describe("PortfolioDashboard (Phase 2)", () => {
  beforeEach(() => mocks.push.mockReset());
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("titles the page with the nav name and keeps the add form behind a button (Phase 1)", async () => {
    mockApis([position]);
    renderDashboard();

    await screen.findAllByRole("link", { name: /トヨタ自動車/ });
    expect(screen.getByRole("heading", { level: 1, name: "保有資産" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("保有数量")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /保有を追加/ }));
    expect(await screen.findByRole("dialog", { name: "保有を追加" })).toBeInTheDocument();
    expect(screen.getByLabelText("保有数量")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("groups holdings by asset class with subtotals, so funds never sit under 日本株 (regression 0-2)", async () => {
    mockApis([position, fund, usStock]);
    renderDashboard();
    await screen.findAllByRole("link", { name: /テストファンド/ });

    const funds = screen.getByRole("region", { name: "投資信託" });
    const jp = screen.getByRole("region", { name: "日本株" });
    const us = screen.getByRole("region", { name: "米国株" });

    expect(within(funds).getAllByRole("link", { name: /テストファンド/ }).length).toBeGreaterThan(0);
    expect(within(jp).queryByRole("link", { name: /テストファンド/ })).not.toBeInTheDocument();
    expect(within(jp).getAllByRole("link", { name: /トヨタ自動車/ }).length).toBeGreaterThan(0);
    expect(within(us).getAllByRole("link", { name: /HP Inc\./ }).length).toBeGreaterThan(0);

    // 基準価額は1万口あたり、評価額は口数×基準価額÷10,000（Phase 0-3）
    expect(within(funds).getAllByText("¥38,532").length).toBeGreaterThan(0);
    expect(within(funds).getAllByText("¥1,029,644").length).toBeGreaterThan(0);
    // USDは円換算して表示し、元の通貨額も併記する
    expect(within(us).getAllByText("¥9,396").length).toBeGreaterThan(0);
    expect(within(us).getAllByText("$62.64").length).toBeGreaterThan(0);
  });

  it("filters by account with chips", async () => {
    mockApis([position, fund]);
    renderDashboard();
    await screen.findAllByRole("link", { name: /トヨタ自動車/ });

    fireEvent.click(screen.getByRole("button", { name: "つみたて投資枠" }));
    expect(screen.getAllByRole("link", { name: /テストファンド/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /トヨタ自動車/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "すべての口座" }));
    expect(screen.getAllByRole("link", { name: /トヨタ自動車/ }).length).toBeGreaterThan(0);
  });

  it("deletes only after a confirmation dialog, from the ⋯ menu", async () => {
    const fetchMock = mockApis([position]);
    renderDashboard();
    await screen.findAllByRole("link", { name: /トヨタ自動車/ });

    fireEvent.click(screen.getAllByRole("button", { name: "トヨタ自動車の操作" })[0]!);
    fireEvent.click(screen.getByRole("menuitem", { name: "削除" }));

    const dialog = await screen.findByRole("dialog", { name: "保有を削除しますか？" });
    expect(fetchMock).not.toHaveBeenCalledWith("/api/positions/p1", { method: "DELETE" });

    fireEvent.click(within(dialog).getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/positions/p1", { method: "DELETE" }));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("edits quantity, cost and account via PATCH", async () => {
    const fetchMock = mockApis([position]);
    renderDashboard();
    await screen.findAllByRole("link", { name: /トヨタ自動車/ });

    fireEvent.click(screen.getAllByRole("button", { name: "トヨタ自動車の操作" })[0]!);
    fireEvent.click(screen.getByRole("menuitem", { name: "編集" }));
    await screen.findByRole("dialog", { name: /トヨタ自動車 を編集/ });

    fireEvent.change(screen.getByLabelText(/数量/), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("口座"), { target: { value: "tsumitate" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([url, init]) => String(url) === "/api/positions/p1" && init?.method === "PATCH"
      );
      expect(call).toBeDefined();
      expect(JSON.parse(String(call![1]!.body))).toEqual({ quantity: 12, avgCost: 100, nisaType: "tsumitate" });
    });
  });

  it("states that USD is excluded when the exchange rate is unavailable", async () => {
    mockApis([position, usStock], null);
    renderDashboard();
    expect(await screen.findByRole("status")).toHaveTextContent("為替レートを取得できなかったため");
  });
});
