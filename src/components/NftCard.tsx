import { Link, useNavigate } from '@tanstack/react-router'
import { Heart, Search, ShoppingBag } from 'lucide-react'
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
  const coverImage = nft.images[0]?.src ?? '/images/nfts/nft-1.png'

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
      className="group relative flex flex-col bg-transparent rounded-[6px] transition-transform"
    >
      <div className="relative w-full aspect-[258/300] bg-[#241612] rounded-[6px] overflow-hidden border border-[#3F2319] group-hover:border-[#D28A4C] transition-colors">
        <Link
          to="/nfts/$nftId"
          params={{ nftId: nft.id }}
          aria-label={`Ver detalhes de ${nft.name}`}
          className="block w-full h-full"
        >
          <img
            src={coverImage}
            alt={nft.name}
            width={258}
            height={300}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding={priority ? 'sync' : 'async'}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        </Link>

        {nft.badge && (
          <span
            data-testid={`nft-badge-${nft.id}`}
            className="absolute top-3 left-3 px-2.5 py-1 rounded bg-[#D28A4C] text-[#140D0A] text-[11px] font-bold uppercase tracking-wider shadow"
          >
            {nft.badge}
          </span>
        )}

        {isSoldOut && (
          <span
            data-testid={`nft-soldout-${nft.id}`}
            className="absolute top-3 right-3 px-2.5 py-1 rounded bg-[#140D0A]/90 border border-[#F0805F] text-[#F0805F] text-[11px] font-bold uppercase"
          >
            Esgotado
          </span>
        )}

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2.5 opacity-95 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={isSoldOut || addItem.isPending}
            data-testid={`nft-quick-add-${nft.id}`}
            aria-label={`Adicionar ${nft.name} ao carrinho`}
            title="Adicionar ao carrinho"
            className="w-[38px] h-[38px] rounded-[6px] bg-[#241612]/95 border border-[#3F2319] hover:border-[#D28A4C] text-[#F5F1EB] hover:text-[#E89B55] disabled:opacity-40 flex items-center justify-center shadow-md transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleToggleFavorite}
            data-testid={`nft-fav-btn-${nft.id}`}
            aria-pressed={isFavorite}
            aria-label={
              isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`
            }
            title={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
            className={`w-[38px] h-[38px] rounded-[6px] bg-[#241612]/95 border ${
              isFavorite
                ? 'border-[#E89B55] text-[#E89B55]'
                : 'border-[#3F2319] text-[#F5F1EB] hover:border-[#D28A4C] hover:text-[#E89B55]'
            } flex items-center justify-center shadow-md transition-colors`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#E89B55]' : ''}`} />
          </button>

          <Link
            to="/nfts/$nftId"
            params={{ nftId: nft.id }}
            aria-label={`Abrir página de ${nft.name}`}
            title="Ver detalhes"
            className="w-[38px] h-[38px] rounded-[6px] bg-[#241612]/95 border border-[#3F2319] hover:border-[#D28A4C] text-[#F5F1EB] hover:text-[#E89B55] flex items-center justify-center shadow-md transition-colors"
          >
            <Search className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="pt-3 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/nfts/$nftId"
            params={{ nftId: nft.id }}
            className="text-base leading-4 text-[#F5F1EB] hover:text-[#E89B55] truncate transition-colors"
          >
            {nft.name}
          </Link>
          <span className="text-[11px] text-[#B39463] shrink-0 uppercase">
            {nft.network ?? 'ethereum'}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-0.5">
          <span
            data-testid={`nft-price-${nft.id}`}
            className="text-lg leading-5 font-bold text-[#E89B55]"
          >
            {formatEth(nft.floorPrice, { withSymbol: false })} ETH
          </span>
          {nft.compareAtPrice && (
            <span className="text-base leading-4 text-[#B39463] line-through">
              {formatEth(nft.compareAtPrice, { withSymbol: false })} ETH
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

