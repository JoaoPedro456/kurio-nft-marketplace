import { Link, useNavigate } from '@tanstack/react-router'
import { Heart, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { AppApiError } from '@/lib/api/client'
import type { Nft } from '@/lib/api/contracts'
import { useCartMutations, useFavoritesQuery, useToggleFavoriteMutation } from '@/lib/hooks'
import { formatEth } from '@/lib/money'
import { useAuthSnapshot } from '@/lib/session'

interface NftCardProps {
  nft: Nft
  priority?: boolean
}

export function NftCard({ nft, priority = false }: NftCardProps) {
  const navigate = useNavigate()
  const { session } = useAuthSnapshot()
  const { data: favorites } = useFavoritesQuery()
  const toggleFavorite = useToggleFavoriteMutation()
  const { addItem } = useCartMutations()

  const isFavorite = favorites?.nftIds.includes(nft.id) ?? false
  const defaultEdition =
    nft.editions.find((ed) => ed.enabled && ed.available > 0) ?? nft.editions[0]

  const isSoldOut = nft.totalAvailable <= 0 || !defaultEdition || defaultEdition.available <= 0
  const coverImage = nft.images[0]?.src ?? '/assets/nft/nft-artwork-03.png'

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!session) {
      toast.info('Faça login para salvar este NFT nos seus favoritos.')
      navigate({ to: '/login', search: { redirect: window.location.pathname } })
      return
    }
    toggleFavorite.mutate({ nftId: nft.id, isFavorite })
  }

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isSoldOut || !defaultEdition) {
      toast.error('Este NFT está esgotado no momento.')
      return
    }
    addItem.mutate(
      { nftId: nft.id, editionId: defaultEdition.id, quantity: 1 },
      {
        onSuccess: () => {
          toast.success(`${nft.name} (${defaultEdition.name}) adicionado ao carrinho.`)
        },
        onError: (err) => {
          const msg =
            err instanceof AppApiError ? err.message : 'Não foi possível adicionar ao carrinho.'
          toast.error(msg)
        },
      },
    )
  }

  return (
    <article
      data-testid={`nft-card-${nft.id}`}
      className="group relative flex flex-col transition-transform"
    >
      <div className="relative rounded-lg bg-[#241612] p-2 transition-colors group-hover:bg-[#2E1B14]">
        <Link
          to="/nfts/$nftId"
          params={{ nftId: nft.id }}
          aria-label={`Ver detalhes de ${nft.name}`}
          className="block relative aspect-square w-full rounded-md overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#E09550]"
        >
          <img
            src={coverImage}
            alt={nft.name}
            width={300}
            height={300}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding={priority ? 'sync' : 'async'}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300 rounded-md"
          />
        </Link>

        {nft.badge && (
          <span
            data-testid={`nft-badge-${nft.id}`}
            className="absolute top-4 left-4 px-2 py-0.5 rounded bg-[#D28A4C] text-[#140D0A] text-[10px] font-bold uppercase tracking-wider shadow"
          >
            {nft.badge}
          </span>
        )}

        {isSoldOut && (
          <span
            data-testid={`nft-soldout-${nft.id}`}
            className="absolute top-4 right-4 px-2 py-0.5 rounded bg-[#140D0A]/90 border border-[#F0805F] text-[#F0805F] text-[10px] font-bold uppercase"
          >
            Esgotado
          </span>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-95 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={isSoldOut || addItem.isPending}
            data-testid={`nft-quick-add-${nft.id}`}
            aria-label={`Adicionar ${nft.name} ao carrinho`}
            title="Adicionar ao carrinho"
            className="w-8 h-8 rounded bg-[#140D0A]/90 border border-[#3A251C] hover:border-[#D28A4C] text-[#F5F1EB] hover:text-[#E09550] disabled:opacity-40 flex items-center justify-center shadow-md transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleToggleFavorite}
            data-testid={`nft-fav-btn-${nft.id}`}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
            title={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
            className={`w-8 h-8 rounded bg-[#140D0A]/90 border ${
              isFavorite
                ? 'border-[#E09550] text-[#E09550]'
                : 'border-[#3A251C] text-[#F5F1EB] hover:border-[#D28A4C] hover:text-[#E09550]'
            } flex items-center justify-center shadow-md transition-colors`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-[#E09550]' : ''}`} />
          </button>
        </div>
      </div>

      <Link
        to="/nfts/$nftId"
        params={{ nftId: nft.id }}
        className="mt-3 truncate px-1 text-base font-bold text-[#F5F1EB] hover:text-[#E09550] transition-colors"
      >
        {nft.name}
      </Link>
      <p
        data-testid={`nft-price-${nft.id}`}
        className="mt-1 px-1 pb-1 text-base font-bold text-[#E09550]"
      >
        {formatEth(nft.floorPrice, { withSymbol: false })} ETH
      </p>
    </article>
  )
}
