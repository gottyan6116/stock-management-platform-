"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils/cn";

interface FundSearchItem {
  id: string;
  name: string;
  providerSymbol: string;
}

async function fetchFundSearch(query: string): Promise<FundSearchItem[]> {
  const res = await fetch(`/api/funds/search?q=${encodeURIComponent(query)}&limit=10`);
  if (!res.ok) throw new Error(`fund search failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

/**
 * 自分が過去に手入力登録した投資信託名のみを候補表示するコンボボックス（新規発見用ではない）。
 * フォーカス時（未入力）は登録済みファンドの一覧を表示し、既存登録からの再選択・誤字防止に使う。
 */
export function FundNameCombobox({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
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

  const { data } = useQuery({
    queryKey: ["fund-name-combobox-search", debouncedQuery.trim()],
    queryFn: () => fetchFundSearch(debouncedQuery.trim()),
  });

  const results = data ?? [];

  function selectItem(item: FundSearchItem) {
    onChange(item.name);
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
      {open && results.length > 0 ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full min-w-[280px] overflow-y-auto rounded-card border border-border bg-surface p-1 shadow-card"
        >
          {results.map((item, index) => (
            <li key={item.id} role="option" aria-selected={index === highlightIndex}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectItem(item)}
                className={cn(
                  "w-full truncate rounded-sm px-3 py-2 text-left text-sm font-semibold text-text-primary",
                  index === highlightIndex && "bg-primary-soft"
                )}
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
