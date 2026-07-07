"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Instrument } from "@/types/domain";
import { useToast } from "@/components/feedback/ToastProvider";

interface FavoriteApiItem {
  id: string;
  favoriteId: string;
  createdAt: string;
  providerSymbol: string;
  displaySymbol: string;
  name: string;
  exchange: string | null;
  market: Instrument["market"];
  currency: Instrument["currency"];
  instrumentType: Instrument["instrumentType"];
}

function toInstrument(item: FavoriteApiItem): Instrument {
  return {
    id: item.id,
    providerSymbol: item.providerSymbol,
    displaySymbol: item.displaySymbol,
    name: item.name,
    exchange: item.exchange,
    market: item.market,
    currency: item.currency,
    instrumentType: item.instrumentType,
  };
}

async function extractApiErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? fallback;
}

async function fetchFavorites(): Promise<FavoriteApiItem[]> {
  const res = await fetch("/api/favorites");
  if (!res.ok) throw new Error(await extractApiErrorMessage(res, "お気に入りの取得に失敗しました。"));
  const json = await res.json();
  return json.data;
}

async function postFavorite(providerSymbol: string): Promise<FavoriteApiItem> {
  const res = await fetch("/api/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerSymbol }),
  });
  if (!res.ok) throw new Error(await extractApiErrorMessage(res, "お気に入りの追加に失敗しました。"));
  const json = await res.json();
  return { ...json.data, favoriteId: json.data.id, createdAt: new Date().toISOString() };
}

async function deleteFavorite(instrumentId: string): Promise<void> {
  const res = await fetch(`/api/favorites/${encodeURIComponent(instrumentId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await extractApiErrorMessage(res, "お気に入りの解除に失敗しました。"));
}

interface FavoritesContextValue {
  favoriteInstruments: Instrument[];
  isLoading: boolean;
  isFavorite: (providerSymbol: string) => boolean;
  addFavorite: (instrument: Instrument) => void;
  removeFavorite: (providerSymbol: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

const FAVORITES_KEY = ["favorites"] as const;

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: FAVORITES_KEY,
    queryFn: fetchFavorites,
    staleTime: 30_000,
  });

  const items = useMemo(() => data ?? [], [data]);

  const addMutation = useMutation({
    mutationFn: (instrument: Instrument) => postFavorite(instrument.providerSymbol),
    onMutate: async (instrument) => {
      await queryClient.cancelQueries({ queryKey: FAVORITES_KEY });
      const previous = queryClient.getQueryData<FavoriteApiItem[]>(FAVORITES_KEY) ?? [];
      const optimistic: FavoriteApiItem = {
        id: instrument.id,
        favoriteId: instrument.id,
        createdAt: new Date().toISOString(),
        providerSymbol: instrument.providerSymbol,
        displaySymbol: instrument.displaySymbol,
        name: instrument.name,
        exchange: instrument.exchange,
        market: instrument.market,
        currency: instrument.currency,
        instrumentType: instrument.instrumentType,
      };
      queryClient.setQueryData<FavoriteApiItem[]>(FAVORITES_KEY, [optimistic, ...previous]);
      return { previous };
    },
    onSuccess: () => {
      showToast({ message: "お気に入りに追加しました" }, 2500);
    },
    onError: (error: Error, _instrument, context) => {
      if (context) queryClient.setQueryData(FAVORITES_KEY, context.previous);
      showToast({ message: error.message || "お気に入りの追加に失敗しました。" }, 4000);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: FAVORITES_KEY });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (providerSymbol: string) => {
      const target = items.find((i) => i.providerSymbol === providerSymbol);
      if (!target) throw new Error("お気に入りが見つかりませんでした。");
      return deleteFavorite(target.id);
    },
    onMutate: async (providerSymbol) => {
      await queryClient.cancelQueries({ queryKey: FAVORITES_KEY });
      const previous = queryClient.getQueryData<FavoriteApiItem[]>(FAVORITES_KEY) ?? [];
      const removed = previous.find((i) => i.providerSymbol === providerSymbol) ?? null;
      queryClient.setQueryData<FavoriteApiItem[]>(
        FAVORITES_KEY,
        previous.filter((i) => i.providerSymbol !== providerSymbol)
      );
      return { previous, removed };
    },
    onSuccess: (_data, providerSymbol, context) => {
      const removedInstrument = context?.removed ? toInstrument(context.removed) : null;
      showToast({
        message: `${removedInstrument?.name ?? providerSymbol} をお気に入りから解除しました`,
        actionLabel: "元に戻す",
        onAction: () => {
          if (removedInstrument) addMutation.mutate(removedInstrument);
        },
      });
    },
    onError: (error: Error, _symbol, context) => {
      if (context) queryClient.setQueryData(FAVORITES_KEY, context.previous);
      showToast({ message: error.message || "お気に入りの解除に失敗しました。" }, 4000);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: FAVORITES_KEY });
    },
  });

  const isFavorite = useCallback(
    (providerSymbol: string) => items.some((i) => i.providerSymbol === providerSymbol),
    [items]
  );

  const addFavorite = useCallback(
    (instrument: Instrument) => {
      addMutation.mutate(instrument);
    },
    [addMutation]
  );

  const removeFavorite = useCallback(
    (providerSymbol: string) => {
      removeMutation.mutate(providerSymbol);
    },
    [removeMutation]
  );

  const favoriteInstruments = useMemo(() => items.map(toInstrument), [items]);

  const value = useMemo(
    () => ({ favoriteInstruments, isLoading, isFavorite, addFavorite, removeFavorite }),
    [favoriteInstruments, isLoading, isFavorite, addFavorite, removeFavorite]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
