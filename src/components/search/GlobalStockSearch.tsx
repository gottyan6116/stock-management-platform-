"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import type { Instrument, Market } from "@/types/domain";
import { FavoriteToggle } from "./FavoriteToggle";
import { MarketBadge } from "@/components/tables/MarketBadge";
import { cn } from "@/lib/utils/cn";

const MARKET_ORDER: Market[] = ["JP", "US"];
const MARKET_LABEL: Record<Market, string> = { JP: "日本株", US: "米国株" };

interface SearchApiItem {
  id: string | null;
  providerSymbol: string;
  displaySymbol: string;
  name: string;
  exchange: string | null;
  market: Market;
  currency: Instrument["currency"];
  instrumentType: Instrument["instrumentType"];
  isFavorite: boolean;
}

interface SearchApiResponse {
  data: SearchApiItem[];
  meta: { source: string; query: string; providerError?: boolean };
}

function toInstrument(item: SearchApiItem): Instrument {
  return {
    id: item.id ?? item.providerSymbol,
    providerSymbol: item.providerSymbol,
    displaySymbol: item.displaySymbol,
    name: item.name,
    exchange: item.exchange,
    market: item.market,
    currency: item.currency,
    instrumentType: item.instrumentType,
  };
}

function toDetailHref(item: SearchApiItem) {
  return `/stocks/${encodeURIComponent(item.providerSymbol)}`;
}

async function fetchSearch(query: string): Promise<SearchApiResponse> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=10`);
  if (!res.ok) {
    throw new Error(`search request failed: ${res.status}`);
  }
  return res.json();
}

export function GlobalStockSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [showSpinner, setShowSpinner] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const trimmedQuery = debouncedQuery.trim();
  const searchEnabled = trimmedQuery.length >= 2;

  const {
    data,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["search", trimmedQuery],
    queryFn: () => fetchSearch(trimmedQuery),
    enabled: searchEnabled,
  });

  // 300ms以上かかる場合のみspinnerを出す（設計書31.2）。前回候補は残したまま更新中表示。
  useEffect(() => {
    if (!isFetching) {
      setShowSpinner(false);
      return;
    }
    const timer = setTimeout(() => setShowSpinner(true), 300);
    return () => clearTimeout(timer);
  }, [isFetching]);

  const results = data?.data ?? [];
  const flatResults = MARKET_ORDER.flatMap((market) => results.filter((r) => r.market === market));
  const showEmpty = searchEnabled && !isFetching && !isError && flatResults.length === 0;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, flatResults.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      const target = flatResults[highlightIndex];
      if (target) {
        router.push(toDetailHref(target));
        setOpen(false);
      }
    }
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-button border border-border bg-surface px-3 py-2">
        {showSpinner ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-text-muted" aria-hidden />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        )}
        <input
          ref={inputRef}
          id="global-stock-search-input"
          role="combobox"
          aria-expanded={open}
          aria-controls="global-search-listbox"
          type="text"
          value={query}
          placeholder="銘柄名・コード・ティッカーで検索"
          className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <kbd className="hidden rounded-sm border border-border px-1.5 py-0.5 text-[11px] text-text-muted md:inline">
          /
        </kbd>
      </div>

      {open && searchEnabled ? (
        <ul
          id="global-search-listbox"
          role="listbox"
          className="absolute z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-card border border-border bg-surface p-2 shadow-card"
        >
          {isError ? (
            <li className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm text-text-secondary">
              <span>検索に失敗しました。時間をおいて再度お試しください。</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="rounded-button border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft"
              >
                再試行
              </button>
            </li>
          ) : showEmpty ? (
            <li className="px-3 py-6 text-center text-sm text-text-muted">
              該当する銘柄が見つかりませんでした。検索条件を変えてお試しください。
            </li>
          ) : (
            <>
              {data?.meta.providerError ? (
                <li className="mb-1 flex items-center gap-1.5 rounded-sm bg-warning-soft px-3 py-2 text-xs text-warning">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  外部検索に障害が発生しているため、登録済み銘柄のみ表示しています
                </li>
              ) : null}
              {MARKET_ORDER.map((market) => {
                const marketResults = flatResults.filter((r) => r.market === market);
                if (marketResults.length === 0) return null;
                return (
                  <li key={market}>
                    <p className="px-3 pb-1 pt-2 text-xs font-semibold text-text-muted">
                      {MARKET_LABEL[market]}
                    </p>
                    <ul>
                      {marketResults.map((item) => {
                        const index = flatResults.indexOf(item);
                        const instrument = toInstrument(item);
                        return (
                          <li
                            key={`${item.market}:${item.providerSymbol}`}
                            role="option"
                            aria-selected={index === highlightIndex}
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-sm px-3 py-2",
                              index === highlightIndex && "bg-primary-soft"
                            )}
                          >
                            <a
                              href={toDetailHref(item)}
                              className="flex min-w-0 flex-1 items-center gap-3"
                              onClick={(e) => {
                                e.preventDefault();
                                router.push(toDetailHref(item));
                                setOpen(false);
                              }}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-text-primary">
                                  {item.name}
                                </p>
                                <p className="truncate text-xs text-text-muted">
                                  {item.displaySymbol} · {item.exchange} · {item.currency}
                                </p>
                              </div>
                            </a>
                            <MarketBadge market={item.market} />
                            <FavoriteToggle instrument={instrument} size="sm" />
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </>
          )}
        </ul>
      ) : null}
    </div>
  );
}
