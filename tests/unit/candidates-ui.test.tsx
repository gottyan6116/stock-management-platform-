import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CandidatesDashboard } from "@/components/candidates/CandidatesDashboard";
import { DecisionOutcomesPanel } from "@/components/candidates/DecisionOutcomesPanel";
import { DecisionSheet } from "@/components/candidates/DecisionSheet";
import { BenchmarkSettingsForm } from "@/components/settings/BenchmarkSettingsForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function withClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

type Handler = (url: string, init?: RequestInit) => unknown;
function mockFetch(handler: Handler) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = handler(String(input), init);
    return { ok: body !== undefined, status: body !== undefined ? 200 : 404, json: async () => ({ data: body }) };
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const emptyScenarios = {
  bear: { epsGrowthPct: null, exitPer: null },
  base: { epsGrowthPct: null, exitPer: null },
  bull: { epsGrowthPct: null, exitPer: null },
};

const sheetData = (over: Record<string, unknown> = {}) => ({
  instrument: { id: "i1", name: "テスト株式会社", displaySymbol: "1234" },
  market: { price: 1000, priceDate: "2026-09-30", currency: "JPY", dividendYieldPct: 2, currentPer: 20 },
  sheet: { thesisWhy: "", thesisWrong: "", scenarios: emptyScenarios },
  hurdlePct: 5,
  benchmark: { instrumentId: "b1", name: "オルカン", nav: 40000, navDate: "2026-09-30" },
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe("DecisionSheet", () => {
  it("computes the decomposition live from the inputs, with ± signs and the gap to the hurdle", async () => {
    mockFetch((url) => (url.includes("/api/decision-sheets/") ? sheetData() : undefined));
    withClient(<DecisionSheet instrumentId="i1" />);

    fireEvent.change(await screen.findByLabelText("弱気のEPS成長率（%/年）"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("弱気の5年後PER（倍）"), { target: { value: "20" } });

    // 配当2% + EPS成長5% + PER据え置き(0%) = +7.0%、ハードル5%との差 +2.0pt
    expect(await screen.findByText("+7.0%")).toBeInTheDocument();
    expect(screen.getByText("+2.0pt")).toBeInTheDocument();
    expect(screen.getByText(/株価の予測ではありません/)).toBeInTheDocument();
    expect(screen.getByText("計算式（前提）")).toBeInTheDocument();
  });

  it("says why a scenario cannot be computed instead of showing a number", async () => {
    mockFetch((url) => (url.includes("/api/decision-sheets/") ? sheetData({ market: { ...sheetData().market, currentPer: null } }) : undefined));
    withClient(<DecisionSheet instrumentId="i1" />);

    fireEvent.change(await screen.findByLabelText("中立のEPS成長率（%/年）"), { target: { value: "5" } });
    expect(await screen.findByText(/中立：現在PERが取得できない/)).toBeInTheDocument();
    expect(screen.getByText(/現在PERを取得できません/)).toBeInTheDocument();
  });

  it("does not assume a hurdle: shows 未設定 and a link to settings", async () => {
    mockFetch((url) => (url.includes("/api/decision-sheets/") ? sheetData({ hurdlePct: null }) : undefined));
    withClient(<DecisionSheet instrumentId="i1" />);
    expect(await screen.findByText("未設定")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /設定で入力する/ })).toHaveAttribute("href", "/settings");
  });

  it("records a decision only after confirmation, sending inputs but never prices", async () => {
    const fetchMock = mockFetch((url, init) => {
      if (url === "/api/decisions" && init?.method === "POST") return { ok: true };
      return url.includes("/api/decision-sheets/") ? sheetData() : undefined;
    });
    withClient(<DecisionSheet instrumentId="i1" />);

    fireEvent.change(await screen.findByLabelText("なぜ上がるか"), { target: { value: "成長する" } });
    fireEvent.click(screen.getByRole("button", { name: "購入判断として記録" }));

    const dialog = await screen.findByRole("dialog", { name: "購入判断として記録しますか？" });
    expect(fetchMock.mock.calls.some(([u, i]) => u === "/api/decisions" && (i as RequestInit)?.method === "POST")).toBe(false);
    expect(within(dialog).getByText(/書き換えできません/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "記録する" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("購入判断として記録しました"));

    const call = fetchMock.mock.calls.find(([u, i]) => u === "/api/decisions" && (i as RequestInit)?.method === "POST")!;
    const body = JSON.parse(String((call[1] as RequestInit).body));
    expect(body).toMatchObject({ instrumentId: "i1", decision: "buy", thesisWhy: "成長する" });
    expect(Object.keys(body).sort()).toEqual(["decision", "instrumentId", "scenarios", "thesisWhy", "thesisWrong"]);
  });
});

describe("CandidatesDashboard", () => {
  const candidates = [
    { instrumentId: "a", providerSymbol: "1111.T", displaySymbol: "1111", name: "A社", market: "JP", currency: "JPY", status: "unevaluated", addedAt: "x" },
    { instrumentId: "b", providerSymbol: "2222.T", displaySymbol: "2222", name: "B社", market: "JP", currency: "JPY", status: "considering", addedAt: "x" },
  ];
  const routes: Handler = (url, init) => {
    if (url === "/api/candidates") return candidates;
    if (url.startsWith("/api/candidates/") && init?.method === "PATCH") return { status: "passed" };
    if (url === "/api/favorites/quotes") return [{ providerSymbol: "1111.T", displayPrice: 500, unitDivisor: 1 }];
    if (url === "/api/decisions") return { decisions: [], winRates: { 1: { evaluated: 0, correct: 0, ratePct: null }, 3: { evaluated: 0, correct: 0, ratePct: null } }, benchmarkConfigured: false };
    return undefined;
  };

  it("filters by status with counts and links each row to its decision sheet", async () => {
    mockFetch(routes);
    withClient(<CandidatesDashboard />);

    expect(await screen.findByRole("button", { name: "すべて 2" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "検討中 1" }));
    expect(screen.queryByText("A社")).not.toBeInTheDocument();
    expect(screen.getByText("B社")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /判断シート/ })).toHaveAttribute("href", "/stocks/2222.T?tab=decision");
  });

  it("changes a candidate's status via PATCH", async () => {
    const fetchMock = mockFetch(routes);
    withClient(<CandidatesDashboard />);

    fireEvent.change(await screen.findByLabelText("A社の状態"), { target: { value: "passed" } });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/candidates/a",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "passed" }) })
      )
    );
  });

  it("shows a real price where known and a dash where not (no invented values)", async () => {
    mockFetch(routes);
    withClient(<CandidatesDashboard />);
    const rowA = (await screen.findByText("A社")).closest("tr")!;
    const rowB = screen.getByText("B社").closest("tr")!;
    expect(within(rowA).getByText("¥500")).toBeInTheDocument();
    expect(within(rowB).getByText("—")).toBeInTheDocument();
  });
});

describe("DecisionOutcomesPanel", () => {
  const decision = (over: Record<string, unknown>) => ({
    id: "d1",
    instrumentId: "i1",
    name: "テスト株式会社",
    displaySymbol: "1234",
    decision: "buy",
    decidedOn: "2025-01-10",
    price: 1000,
    currency: "JPY",
    hurdlePct: 5,
    thesisWhy: "",
    thesisWrong: "",
    baseAnnualPct: 8,
    outcomes: {
      1: { status: "ready", stockReturnPct: 20, benchmarkReturnPct: 10, correct: true },
      3: { status: "pending", dueDate: "2028-01-10" },
    },
    ...over,
  });

  it("explains how to start when there are no records", async () => {
    mockFetch(() => ({ decisions: [], winRates: { 1: { evaluated: 0, correct: 0, ratePct: null }, 3: { evaluated: 0, correct: 0, ratePct: null } }, benchmarkConfigured: true }));
    withClient(<DecisionOutcomesPanel />);
    expect(await screen.findByText(/判断を記録すると/)).toBeInTheDocument();
  });

  it("lines up stock vs benchmark, marks pending horizons with a date, and shows the win rate with its sample size", async () => {
    mockFetch(() => ({
      decisions: [decision({})],
      winRates: { 1: { evaluated: 1, correct: 1, ratePct: 100 }, 3: { evaluated: 0, correct: 0, ratePct: null } },
      benchmarkConfigured: true,
    }));
    withClient(<DecisionOutcomesPanel />);

    expect(await screen.findByText("銘柄 +20.0% ／ オルカン +10.0%")).toBeInTheDocument();
    expect(screen.getByText("判断は的中")).toBeInTheDocument();
    expect(screen.getByText("2028-01-10 以降に確認できます")).toBeInTheDocument();
    expect(screen.getByText("1年後の対オルカン勝率").nextElementSibling).toHaveTextContent("100%");
    expect(screen.getByText("1件中 1件が的中（件数が少ないうちは参考値です）")).toBeInTheDocument();
    // 評価できない3年は0%ではなく「—」
    expect(screen.getByText("3年後の対オルカン勝率").nextElementSibling).toHaveTextContent("—");
  });

  it("asks to set the benchmark when records exist without one", async () => {
    mockFetch(() => ({
      decisions: [decision({ outcomes: { 1: { status: "unavailable", reason: "判断時点のオルカンの基準価額が記録されていません" }, 3: { status: "pending", dueDate: "2028-01-10" } } })],
      winRates: { 1: { evaluated: 0, correct: 0, ratePct: null }, 3: { evaluated: 0, correct: 0, ratePct: null } },
      benchmarkConfigured: false,
    }));
    withClient(<DecisionOutcomesPanel />);
    expect(await screen.findByRole("link", { name: /設定で選ぶ/ })).toHaveAttribute("href", "/settings");
    expect(screen.getByText(/算出できません（判断時点のオルカン/)).toBeInTheDocument();
  });

  it("deletes a record only after confirmation", async () => {
    const fetchMock = mockFetch((url, init) =>
      url === "/api/decisions" && !init?.method
        ? { decisions: [decision({})], winRates: { 1: { evaluated: 0, correct: 0, ratePct: null }, 3: { evaluated: 0, correct: 0, ratePct: null } }, benchmarkConfigured: true }
        : url.startsWith("/api/decisions/")
          ? { ok: true }
          : undefined
    );
    withClient(<DecisionOutcomesPanel />);

    fireEvent.click(await screen.findByRole("button", { name: "2025-01-10のテスト株式会社の記録を削除" }));
    const dialog = await screen.findByRole("dialog", { name: "この記録を削除しますか？" });
    expect(fetchMock).not.toHaveBeenCalledWith("/api/decisions/d1", { method: "DELETE", headers: undefined, body: undefined });
    fireEvent.click(within(dialog).getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => u === "/api/decisions/d1" && (i as RequestInit)?.method === "DELETE")).toBe(true));
  });
});

describe("BenchmarkSettingsForm", () => {
  it("saves the user's own hurdle and benchmark fund; an empty return is saved as null, not zero", async () => {
    const fetchMock = mockFetch((url, init) => {
      if (init?.method === "PUT") return { ok: true };
      return url === "/api/settings"
        ? { benchmarkExpectedReturn: null, benchmarkInstrumentId: null, fundChoices: [{ id: "b1", name: "オルカン" }] }
        : undefined;
    });
    withClient(<BenchmarkSettingsForm />);

    fireEvent.change(await screen.findByLabelText("比べるオルカン（保有中の投資信託から選択）"), { target: { value: "b1" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("保存しました"));
    const put = fetchMock.mock.calls.find(([, i]) => (i as RequestInit)?.method === "PUT")!;
    expect(JSON.parse(String((put[1] as RequestInit).body))).toEqual({ benchmarkExpectedReturn: null, benchmarkInstrumentId: "b1" });

    fireEvent.change(screen.getByLabelText("オルカンの想定年率リターン（%）"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      const last = fetchMock.mock.calls.filter(([, i]) => (i as RequestInit)?.method === "PUT").at(-1)!;
      expect(JSON.parse(String((last[1] as RequestInit).body)).benchmarkExpectedReturn).toBe(5);
    });
  });
});
