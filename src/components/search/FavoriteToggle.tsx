"use client";

import { Star } from "lucide-react";
import type { Instrument } from "@/types/domain";
import { useFavorites } from "@/features/favorites/FavoritesProvider";
import { cn } from "@/lib/utils/cn";

export function FavoriteToggle({
  instrument,
  size = "md",
}: {
  instrument: Instrument;
  size?: "sm" | "md";
}) {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const active = isFavorite(instrument.providerSymbol);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (active) {
      removeFavorite(instrument.providerSymbol);
    } else {
      addFavorite(instrument);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? "お気に入りから解除" : "お気に入りに追加"}
      className={cn(
        "flex items-center justify-center rounded-sm p-1.5 transition-colors",
        "min-h-[32px] min-w-[32px]",
        active
          ? "text-primary"
          : "text-text-muted hover:bg-surface-subtle hover:text-text-secondary"
      )}
    >
      <Star
        className={cn(size === "sm" ? "h-4 w-4" : "h-5 w-5")}
        fill={active ? "currentColor" : "none"}
        aria-hidden
      />
    </button>
  );
}
