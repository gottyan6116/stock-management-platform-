"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { FavoritesProvider } from "@/features/favorites/FavoritesProvider";
import { ToastProvider } from "@/components/feedback/ToastProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FavoritesProvider>{children}</FavoritesProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
