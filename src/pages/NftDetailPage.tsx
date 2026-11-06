import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  AlertCircle,
  Heart,
  Minus,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Star,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppApiError } from '@/lib/api/client'
import {
  useCartMutations,
  useFavoritesQuery,
  useFeaturedNftsQuery,
  useNftDetailQuery,
  useToggleFavoriteMutation,
} from '@/lib/hooks'
import { formatEth } from '@/lib/money'
import { useAuthSnapshot } from '@/lib/session'
import { NftCard } from '@/components/NftCard'

export function NftDetailPage() {
  const { nftId } = useParams({ strict: false }) as { nftId: string }
  const navigate = useNavigate()
  const { session } = useAuthSnapshot()
  const { data: nft, isLoading, isError, error } = useNftDetailQuery(nftId)
  const { data: relatedNfts } = useFeaturedNftsQuery()
  const { data: favorites } = useFavoritesQuery()
  const toggleFavorite = useToggleFavoriteMutation()
  const { addItem } = useCartMutations()

  const [selectedEditionId, setSelectedEditionId] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0)
  const [activeTab, setActiveTab] = useState<'details' | 'reviews'>('details')

  useEffect(() => {
    if (!nft) return
    const currentValid = nft.editions.find((e) => e.id === selectedEditionId)
    if (!currentValid) {
      const firstAvailable =
        nft.editions.find((e) => e.enabled && e.available > 0) ?? nft.editions[0]
      if (firstAvailable) {
        setSelectedEditionId(firstAvailable.id)
      }
    }
  }, [nft, selectedEditionId])

  const selectedEdition =
    nft?.editions.find((e) => e.id === selectedEditionId) ?? nft?.editions[0]

  const maxAllowed =
    selectedEdition && selectedEdition.enabled
      ? Math.max(0, Math.min(selectedEdition.available, selectedEdition.maxPerOrder))
      : 0

  useEffect(() => {
    if (maxAllowed > 0 && quantity > maxAllowed) {
      setQuantity(maxAllowed)
    } else if (maxAllowed > 0 && quantity < 1) {
      setQuantity(1)
    }
  }, [maxAllowed, quantity])

  if (isLoading) {
    const knownImg = /^nft-([1-9]|1[0-6])$/.test(nftId) ? `/images/nfts/${nftId}.png` : null
    return (
      <div
        data-testid="nft-detail-loading"
        className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-8"
      >
        <div className="h-5 w-48 rounded skeleton-shimmer" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6 aspect-square rounded-[6px] bg-[#241612] border border-[#3F2319] overflow-hidden">
            {knownImg ? (
              <img
                src={knownImg}
                alt="Arte digital em carregamento"
                width={444}
                height={444}
                fetchPriority="high"
                decoding="sync"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full skeleton-shimmer" />
            )}
          </div>
          <div className="lg:col-span-6 space-y-4">
            <div className="h-8 w-2/3 rounded skeleton-shimmer" />
            <div className="h-6 w-1/3 rounded skeleton-shimmer" />
            <div className="h-24 w-full rounded skeleton-shimmer" />
            <div className="h-12 w-full rounded skeleton-shimmer" />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !nft) {
    const isNotFound = error instanceof AppApiError && error.status === 404
    return (
      <div
        role="alert"
        data-testid="nft-detail-not-found"
        className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16"
      >
        <div className="max-w-lg mx-auto rounded-[8px] bg-[#241612] border border-[#3F2319] p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-[#F0805F] mx-auto" />
          <h1 className="text-xl font-bold text-[#F5F1EB]">
            {isNotFound ? 'NFT não encontrado (404)' : 'Erro ao carregar o NFT'}
          </h1>
          <p className="text-xs sm:text-sm text-[#CFB28C]">
            {error instanceof Error
              ? error.message
              : 'O token solicitado não existe ou foi removido do catálogo da Kurio.'}
          </p>
          <Link
            to="/"
            data-testid="back-to-catalog-link"
            className="h-10 px-6 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-xs uppercase inline-flex items-center justify-center transition-colors"
          >
            Voltar ao catálogo
          </Link>
        </div>
      </div>
    )
  }

  const isFavorite = favorites?.nftIds.includes(nft.id) ?? false
  const isSoldOut =
    !selectedEdition || !selectedEdition.enabled || selectedEdition.available <= 0

  const mainImageSrc = nft.images[0]?.src ?? '/images/nfts/nft-1.png'
  const galleryImages =
    nft.images.length >= 4
      ? nft.images.map((i) => i.src)
      : [
          mainImageSrc,
          nft.images[1]?.src ?? '/images/nfts/nft-6.png',
          nft.images[2]?.src ?? '/images/nfts/nft-7.png',
          '/images/nfts/nft-8.png',
        ]

  const handleAddToCart = (goToCart = false) => {
    if (!selectedEdition || isSoldOut) {
      toast.error('Esta edição está indisponível ou esgotada.')
      return
    }
    addItem.mutate(
      {
        nftId: nft.id,
        editionId: selectedEdition.id,
        quantity,
      },
      {
        onSuccess: () => {
          toast.success(
            `${quantity}x ${nft.name} (${selectedEdition.name}) adicionado ao carrinho!`,
          )
          if (goToCart) {
            navigate({ to: '/cart' })
          }
        },
        onError: (err) => {
          const msg =
            err instanceof AppApiError ? err.message : 'Não foi possível adicionar ao carrinho.'
          toast.error(msg)
        },
      },
    )
  }

  const handleFavorite = () => {
    if (!session) {
      toast.info('Faça login para salvar este NFT nos seus favoritos.')
      navigate({ to: '/login', search: { redirect: `/nfts/${nft.id}` } })
      return
    }
    toggleFavorite.mutate({ nftId: nft.id, isFavorite })
  }

  const reviewsCount = nft.reviewsCount ?? 19
  const tokenId = nft.tokenId ?? `#00${nft.id.replace(/\D/g, '').padStart(2, '0')}`
  const attributes = nft.attributes ?? ['Óculos', 'Esmeralda', 'Raro']

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 space-y-12 pb-16">
      <nav aria-label="Breadcrumb" className="text-sm text-[#CFB28C] flex items-center gap-2">
        <Link to="/" className="font-bold text-[#F5F1EB] hover:text-[#E89B55]">
          Início
        </Link>
        <span>/</span>
        <Link to="/" hash="catalogo-nfts" className="hover:text-[#F5F1EB]">
          Mercado
        </Link>
        <span>/</span>
        <span className="text-[#E89B55] truncate">{nft.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-6 flex flex-col-reverse sm:flex-row gap-4">
          <div className="flex sm:flex-col gap-3 overflow-x-auto sm:overflow-visible">
            {galleryImages.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImageIdx(idx)}
                aria-label={`Miniatura ${idx + 1} de ${nft.name}`}
                className={`w-20 h-20 sm:w-[100px] sm:h-[100px] rounded-[6px] bg-[#241612] overflow-hidden border shrink-0 transition-colors ${
                  activeImageIdx === idx
                    ? 'border-[#D28A4C]'
                    : 'border-[#3F2319] hover:border-[#D28A4C]/60'
                }`}
              >
                <img
                  src={imgUrl}
                  alt={`${nft.name} visão ${idx + 1}`}
                  width={100}
                  height={100}
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>

          <div className="relative flex-1 aspect-square rounded-[6px] bg-[#241612] border border-[#3F2319] overflow-hidden">
            <img
              src={galleryImages[activeImageIdx] ?? mainImageSrc}
              alt={nft.name}
              width={444}
              height={444}
              fetchPriority="high"
              decoding="sync"
              className="w-full h-full object-cover"
            />
            <span className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#140D0A]/80 border border-[#3F2319] flex items-center justify-center text-[#F5F1EB]">
              <Search className="w-4 h-4" />
            </span>
          </div>
        </div>

        <div className="lg:col-span-6 space-y-5">
          <div className="space-y-2 border-b border-[#3F2319] pb-4">
            <h1
              data-testid="nft-detail-title"
              className="text-2xl sm:text-[28px] font-bold text-[#F5F1EB] leading-tight"
            >
              {nft.name}
            </h1>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <div className="flex items-baseline gap-3">
                <span
                  data-testid="nft-detail-price"
                  className="text-[22px] font-bold text-[#E89B55]"
                >
                  {formatEth(selectedEdition?.price ?? nft.floorPrice, { withSymbol: false })} ETH
                </span>
                {nft.compareAtPrice && (
                  <span className="text-sm text-[#B39463] line-through">
                    {formatEth(nft.compareAtPrice, { withSymbol: false })} ETH
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div role="img" className="flex items-center gap-0.5 text-[#E8B23B]" aria-label="5 estrelas">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#E8B23B]" />
                  ))}
                </div>
                <span className="text-xs sm:text-sm text-[#F5F1EB]">
                  {reviewsCount} avaliações de colecionadores
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-sm font-medium text-[#F5F1EB]">Sobre este NFT:</h2>
            <p className="text-xs sm:text-sm leading-6 text-[#CFB28C]">{nft.description}</p>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#F5F1EB]">Edição:</span>
              {selectedEdition && (
                <span
                  data-testid="edition-stock-status"
                  className={`text-xs font-bold ${
                    selectedEdition.enabled && selectedEdition.available > 0
                      ? 'text-[#4E9B6F]'
                      : 'text-[#F0805F]'
                  }`}
                >
                  {selectedEdition.enabled && selectedEdition.available > 0
                    ? `${selectedEdition.available} disponíveis de ${selectedEdition.supply} (máx. ${selectedEdition.maxPerOrder}/pedido)`
                    : 'Edição indisponível / esgotada'}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5" role="radiogroup" aria-label="Selecionar edição">
              {nft.editions.map((ed) => {
                const isSelected = ed.id === selectedEdition?.id
                const outOfStock = !ed.enabled || ed.available <= 0
                return (
                  <button
                    key={ed.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    data-testid={`edition-option-${ed.id}`}
                    onClick={() => {
                      setSelectedEditionId(ed.id)
                      setQuantity(1)
                    }}
                    className={`min-w-[56px] h-9 px-3 rounded-full border text-xs font-bold uppercase transition-colors ${
                      isSelected
                        ? 'border-[#D28A4C] bg-[#2F1D15] text-[#E89B55]'
                        : outOfStock
                          ? 'border-[#3F2319] bg-[#140D0A]/60 text-[#B39463] line-through opacity-60'
                          : 'border-[#3F2319] bg-[#241612] text-[#CFB28C] hover:border-[#D28A4C]'
                    }`}
                  >
                    {ed.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-3 bg-[#241612] border border-[#3F2319] rounded-full p-1">
              <button
                type="button"
                data-testid="qty-decrease"
                aria-label="Diminuir quantidade"
                disabled={isSoldOut || quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-9 rounded-full bg-[#D28A4C] hover:bg-[#E89B55] disabled:opacity-40 text-[#140D0A] font-bold flex items-center justify-center transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span
                data-testid="qty-value"
                className="min-w-[24px] text-center text-base font-bold text-[#F5F1EB]"
              >
                {isSoldOut ? 0 : quantity}
              </span>
              <button
                type="button"
                data-testid="qty-increase"
                aria-label="Aumentar quantidade"
                disabled={isSoldOut || quantity >= maxAllowed}
                onClick={() => setQuantity((q) => Math.min(maxAllowed, q + 1))}
                className="w-8 h-9 rounded-full bg-[#D28A4C] hover:bg-[#E89B55] disabled:opacity-40 text-[#140D0A] font-bold flex items-center justify-center transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              data-testid="buy-now-btn"
              disabled={isSoldOut || addItem.isPending}
              onClick={() => handleAddToCart(true)}
              className="h-10 px-6 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] disabled:opacity-40 text-[#140D0A] font-bold text-sm uppercase transition-colors"
            >
              {isSoldOut ? 'ESGOTADO' : 'COMPRAR'}
            </button>

            <button
              type="button"
              data-testid="add-to-cart-btn"
              disabled={isSoldOut || addItem.isPending}
              onClick={() => handleAddToCart(false)}
              className="h-10 px-5 rounded-[6px] border border-[#D28A4C] hover:bg-[#2F1D15] disabled:opacity-40 text-[#E89B55] font-bold text-xs uppercase inline-flex items-center gap-2 transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Adicionar ao carrinho</span>
            </button>

            <button
              type="button"
              data-testid="detail-favorite-btn"
              aria-pressed={isFavorite}
              aria-label={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
              onClick={handleFavorite}
              className={`h-10 px-4 rounded-[6px] border flex items-center gap-2 text-xs font-bold uppercase transition-colors ${
                isFavorite
                  ? 'border-[#D28A4C] bg-[#2F1D15] text-[#E89B55]'
                  : 'border-[#3F2319] bg-[#241612] text-[#F5F1EB] hover:border-[#D28A4C]'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#E89B55]' : ''}`} />
              <span>Favoritar</span>
            </button>
          </div>

          <div className="pt-3 border-t border-[#3F2319] space-y-1.5 text-sm text-[#CFB28C]">
            <p>
              ID do token: <strong className="text-[#F5F1EB]">{tokenId}</strong>
            </p>
            <p>
              Coleção: <strong className="text-[#F5F1EB]">{nft.collection}</strong>
            </p>
            <p>
              Atributos: <strong className="text-[#F5F1EB]">{attributes.join(', ')}</strong>
            </p>
            <p className="flex items-center gap-2 pt-1">
              <ShieldCheck className="w-4 h-4 text-[#4E9B6F]" />
              <span>
                Criador verificado: {nft.creator.name} (@{nft.creator.username})
              </span>
            </p>
            <div className="flex items-center gap-3 pt-2">
              <span className="font-medium text-[#F5F1EB]">Compartilhe este NFT:</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href)
                  toast.success('Link do NFT copiado para a área de transferência!')
                }}
                className="inline-flex items-center gap-1.5 text-xs text-[#E89B55] hover:underline"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Copiar link</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <section aria-label="Informações detalhadas do NFT" className="space-y-6">
        <div className="border-b border-[#3F2319] flex items-center gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`relative pb-3 text-base transition-colors ${
              activeTab === 'details'
                ? 'text-[#E89B55] font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-[#D28A4C]'
                : 'text-[#F5F1EB] hover:text-[#E89B55]'
            }`}
          >
            Detalhes do NFT
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={`relative pb-3 text-base transition-colors ${
              activeTab === 'reviews'
                ? 'text-[#E89B55] font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-[#D28A4C]'
                : 'text-[#F5F1EB] hover:text-[#E89B55]'
            }`}
          >
            Avaliações de colecionadores ({reviewsCount})
          </button>
        </div>

        {activeTab === 'details' ? (
          <div className="space-y-4 text-xs sm:text-sm leading-6 text-[#CFB28C] max-w-4xl">
            <p>
              Esta peça faz parte da coleção oficial{' '}
              <strong className="text-[#F5F1EB]">{nft.collection}</strong>, cunhada originalmente
              por <strong className="text-[#F5F1EB]">{nft.creator.name}</strong> na rede{' '}
              <strong className="text-[#F5F1EB] uppercase">{nft.network ?? 'ethereum'}</strong>.
              Cada edição possui metadados imutáveis armazenados em IPFS e verificação criptográfica
              de procedência.
            </p>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#F5F1EB]">Propriedades da edição:</h3>
              <p>
                Ao adquirir este NFT, a titularidade do token {tokenId} é transferida diretamente
                para o endereço da carteira conectada no momento do checkout, dando acesso imediato
                a drops futuros e canais exclusivos de colecionadores da Kurio.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-[6px] bg-[#241612] border border-[#3F2319] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#F5F1EB]">
                  0x71C...8976F (Colecionador Verificado)
                </span>
                <span className="text-xs text-[#E8B23B]">★★★★★</span>
              </div>
              <p className="text-xs text-[#CFB28C] leading-5">
                Excelente acabamento generativo e liquidação rápida no checkout. A edição limitada
                chegou na carteira logo após a confirmação on-chain.
              </p>
            </div>
            <div className="p-4 rounded-[6px] bg-[#241612] border border-[#3F2319] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#F5F1EB]">vitalik_br.eth</span>
                <span className="text-xs text-[#E8B23B]">★★★★★</span>
              </div>
              <p className="text-xs text-[#CFB28C] leading-5">
                Traços raros muito bem equilibrados. Uma das melhores coleções listadas na Kurio
                neste trimestre.
              </p>
            </div>
          </div>
        )}
      </section>

      {relatedNfts && relatedNfts.length > 0 && (
        <section aria-label="Itens relacionados" className="space-y-5 pt-4">
          <div className="border-b border-[#3F2319] pb-2">
            <h2 className="text-base font-bold text-[#E89B55]">Itens relacionados</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            {relatedNfts
              .filter((item) => item.id !== nft.id)
              .slice(0, 5)
              .map((item) => (
                <NftCard key={item.id} nft={item} />
              ))}
          </div>
        </section>
      )}
    </div>
  )
}

