"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Market } from "@/types/domain";
import { MarketBadge } from "@/components/tables/MarketBadge";
import { cn } from "@/lib/utils/cn";

interface SearchApiItem {
  providerSymbol: string;
  displaySymbol: string;
  name: string;
  exchange: string | null;
  market: Market;
  currency: string;
}

async function fetchSearch(query: string): Promise<SearchApiItem[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`);
  if (!res.ok) throw new Error(`search request failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

/**
 * 銘柄コード・銘柄名の両方で入力候補をプルダウン表示するコンボボックス。
 * 選択すると providerSymbol を onSelect に渡す（GlobalStockSearchと同じ /api/search を利用）。
 */
export function SymbolCombobox({
  value,
  onChange,
  onSelect,
  placeholder,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (item: SearchApiItem) => void;
  placeholder?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(value);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(value), 300);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const trimmedQuery = debouncedQuery.trim();
  const enabled = trimmedQuery.length >= 2;

  const { data } = useQuery({
    queryKey: ["symbol-combobox-search", trimmedQuery],
    queryFn: () => fetchSearch(trimmedQuery),
    enabled,
  });

  const results = data ?? [];

  function selectItem(item: SearchApiItem) {
    onChange(item.providerSymbol);
    onSelect?.(item);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      const target = results[highlightIndex];
      if (target) {
        e.preventDefault();
        selectItem(target);
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlightIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
      />
      {open && enabled && results.length > 0 ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full min-w-[280px] overflow-y-auto rounded-card border border-border bg-surface p-1 shadow-card"
        >
          {results.map((item, index) => (
            <li key={`${item.market}:${item.providerSymbol}`} role="option" aria-selected={index === highlightIndex}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectItem(item)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left",
                  index === highlightIndex && "bg-primary-soft"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">{item.name}</p>
                  <p className="truncate text-xs text-text-muted">
                    {item.displaySymbol} · {item.exchange ?? "—"} · {item.currency}
                  </p>
                </div>
                <MarketBadge market={item.market} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
