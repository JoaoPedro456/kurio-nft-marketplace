export function NftCardSkeleton() {
  return (
    <div
      data-testid="nft-card-skeleton"
      aria-hidden="true"
      className="flex flex-col rounded-[6px]"
    >
      <div className="w-full aspect-[258/300] rounded-[6px] border border-[#3F2319] skeleton-shimmer" />
      <div className="pt-3 space-y-2">
        <div className="h-4 w-3/4 rounded skeleton-shimmer" />
        <div className="h-5 w-1/2 rounded skeleton-shimmer" />
      </div>
    </div>
  )
}

