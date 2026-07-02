"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Instrument } from "@/types/domain";
import { MOCK_INSTRUMENT_CATALOG } from "@/lib/mock/instrument-catalog";

/**
 * Phase 1〜3 の暫定実装。API/DB (Phase 4) が無いため、お気に入り状態をブラウザ内メモリで
 * 保持する。`useFavorites()` の呼び出し側インターフェースは Phase 4 でも変えない想定で、
 * 内部実装だけを TanStack Query + /api/favorites に差し替える。
 */

const INITIAL_FAVORITE_SYMBOLS = ["7203.T", "8306.T", "AAPL", "NVDA", "MSFT"];

interface FavoritesContextValue {
  favoriteInstruments: Instrument[];
  isFavorite: (providerSymbol: string) => boolean;
  addFavorite: (instrument: Instrument) => void;
  removeFavorite: (providerSymbol: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [symbols, setSymbols] = useState<string[]>(INITIAL_FAVORITE_SYMBOLS);

  const isFavorite = useCallback((providerSymbol: string) => symbols.includes(providerSymbol), [
    symbols,
  ]);

  const addFavorite = useCallback((instrument: Instrument) => {
    setSymbols((prev) => (prev.includes(instrument.providerSymbol) ? prev : [...prev, instrument.providerSymbol]));
  }, []);

  const removeFavorite = useCallback((providerSymbol: string) => {
    setSymbols((prev) => prev.filter((s) => s !== providerSymbol));
  }, []);

  const favoriteInstruments = useMemo(
    () =>
      symbols
        .map((symbol) => MOCK_INSTRUMENT_CATALOG[symbol])
        .filter((instrument): instrument is Instrument => Boolean(instrument)),
    [symbols]
  );

  const value = useMemo(
    () => ({ favoriteInstruments, isFavorite, addFavorite, removeFavorite }),
    [favoriteInstruments, isFavorite, addFavorite, removeFavorite]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
