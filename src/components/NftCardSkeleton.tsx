export function NftCardSkeleton() {
  return (
    <div
      data-testid="nft-card-skeleton"
      aria-hidden="true"
      className="group"
    >
      <div className="rounded-lg bg-[#241612] p-2">
        <div className="aspect-square w-full rounded-md skeleton-shimmer bg-[#2E1B14]" />
      </div>
      <div className="mt-3 h-5 w-3/4 rounded skeleton-shimmer bg-[#2E1B14]" />
      <div className="mt-2 h-5 w-1/3 rounded skeleton-shimmer bg-[#2E1B14]" />
    </div>
  )
}
