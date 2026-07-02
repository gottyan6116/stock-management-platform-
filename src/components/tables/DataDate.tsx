import { formatDate } from "@/lib/utils/format";

export function DataDate({ priceDate }: { priceDate: string | null }) {
  return <span className="text-xs text-text-muted">{formatDate(priceDate)}</span>;
}
