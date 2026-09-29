import { ASSET_CLASS_LABEL, type AssetClass } from "@/lib/domain/asset-class";
import { cn } from "@/lib/utils/cn";

const CLASS: Record<AssetClass, string> = {
  fund: "bg-success-soft text-success-text",
  jp_stock: "bg-primary-soft text-primary",
  us_stock: "bg-text-primary/5 text-text-secondary",
};

/** 資産クラス（投資信託／日本株／米国株）のバッジ。市場(JP/US)ではなく資産クラスで区別する。 */
export function AssetClassBadge({ assetClass }: { assetClass: AssetClass }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm px-2 py-0.5 text-xs font-semibold",
        CLASS[assetClass]
      )}
    >
      {ASSET_CLASS_LABEL[assetClass]}
    </span>
  );
}
