"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface InstrumentDetailTab {
  id: string;
  label: string;
  content: ReactNode;
}

export function InstrumentDetailTabs({ tabs }: { tabs: readonly InstrumentDetailTab[] }) {
  const prefix = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeId)
  );

  function move(delta: number, event: KeyboardEvent<HTMLButtonElement>) {
    if (tabs.length === 0) return;
    event.preventDefault();
    const next = (activeIndex + delta + tabs.length) % tabs.length;
    const nextId = tabs[next]!.id;
    setActiveId(nextId);
    tabRefs.current.get(nextId)?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="銘柄情報"
        aria-orientation="horizontal"
        className="flex overflow-x-auto border-b border-border"
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              id={`${prefix}-${tab.id}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${prefix}-${tab.id}-panel`}
              tabIndex={selected ? 0 : -1}
              ref={(node) => {
                if (node) {
                  tabRefs.current.set(tab.id, node);
                } else {
                  tabRefs.current.delete(tab.id);
                }
              }}
              className={`min-h-11 flex-none whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus active:bg-primary-soft disabled:pointer-events-none disabled:opacity-50 ${
                selected
                  ? "border-primary text-text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") move(1, event);
                if (event.key === "ArrowLeft") move(-1, event);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${prefix}-${tab.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${prefix}-${tab.id}-tab`}
          hidden={tab.id !== activeId}
          className="pt-4"
        >
          {tab.id === activeId ? tab.content : null}
        </div>
      ))}
    </div>
  );
}
