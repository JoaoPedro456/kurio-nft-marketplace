import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppApiError } from '@/lib/api/client'
import { useCartMutations, useCartQuery, useFeaturedNftsQuery } from '@/lib/hooks'
import { formatEth } from '@/lib/money'
import { NftCard } from '@/components/NftCard'

export function CartPage() {
  const navigate = useNavigate()
  const { data: cart, isLoading } = useCartQuery()
  const { data: relatedNfts } = useFeaturedNftsQuery()
  const { updateItem, removeItem, acknowledgeIssues, applyCoupon, removeCoupon } =
    useCartMutations()

  const [couponInput, setCouponInput] = useState('')
  const [couponError, setCouponError] = useState<string | null>(null)

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault()
    setCouponError(null)
    const code = couponInput.trim().toUpperCase()
    if (!code) {
      setCouponError('Digite um código promocional válido.')
      return
    }
    applyCoupon.mutate(code, {
      onSuccess: () => {
        setCouponInput('')
        setCouponError(null)
        toast.success(`Cupom ${code} aplicado com sucesso!`)
      },
      onError: (err) => {
        const msg =
          err instanceof AppApiError ? err.message : 'Não foi possível aplicar o cupom.'
        setCouponError(msg)
        toast.error(msg)
      },
    })
  }

  const handleRemoveCoupon = () => {
    setCouponError(null)
    removeCoupon.mutate(undefined, {
      onSuccess: () => {
        toast.info('Cupom removido do carrinho.')
      },
    })
  }

  const hasPriceChanged =
    cart?.items.some((i) => i.issues.includes('PRICE_CHANGED')) ?? false
  const hasStockIssue =
    cart?.items.some(
      (i) =>
        i.issues.includes('INSUFFICIENT_STOCK') ||
        i.issues.includes('SOLD_OUT') ||
        i.issues.includes('EDITION_UNAVAILABLE'),
    ) ?? false
  const hasBlockingIssues = hasPriceChanged || hasStockIssue

  const handleProceedToCheckout = () => {
    if (!cart || cart.items.length === 0) return
    if (hasBlockingIssues) {
      toast.error(
        'Por favor, confirme as atualizações de preço ou remova itens sem estoque antes de prosseguir.',
      )
      return
    }
    navigate({ to: '/checkout' })
  }

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
        <span className="text-[#E89B55]">Carrinho</span>
      </nav>

      {cart && hasBlockingIssues && (
        <div
          role="alert"
          data-testid="cart-issues-banner"
          className="rounded-[6px] bg-[#38220F] border border-[#F0805F] p-4 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#F0805F] shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs sm:text-sm">
              <p className="font-bold text-[#F5F1EB]">
                {hasStockIssue
                  ? 'Alguns NFTs no seu carrinho ficaram sem estoque suficiente.'
                  : 'O preço de um ou mais NFTs foi atualizado em tempo real.'}
              </p>
              <p className="text-[#CFB28C]">
                {hasStockIssue
                  ? 'Ajuste a quantidade ou remova o item esgotado para liberar o checkout.'
                  : 'Confirme os novos valores em ETH antes de avançar para o pagamento.'}
              </p>
            </div>
          </div>

          {hasPriceChanged && (
            <button
              type="button"
              data-testid="cart-acknowledge-btn"
              disabled={acknowledgeIssues.isPending}
              onClick={() =>
                acknowledgeIssues.mutate(undefined, {
                  onSuccess: () => toast.success('Novos preços confirmados no carrinho.'),
                })
              }
              className="h-9 px-4 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-xs uppercase inline-flex items-center gap-1.5 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar novos preços</span>
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-[6px] skeleton-shimmer" />
            ))}
          </div>
          <div className="lg:col-span-4 h-80 rounded-[6px] skeleton-shimmer" />
        </div>
      ) : !cart || cart.items.length === 0 ? (
        <div
          data-testid="cart-empty-state"
          className="rounded-[8px] bg-[#241612] border border-[#3F2319] p-12 text-center space-y-4"
        >
          <ShoppingBag className="w-12 h-12 text-[#E89B55] mx-auto" />
          <h1 className="text-xl font-bold text-[#F5F1EB]">Seu carrinho está vazio</h1>
          <p className="text-xs sm:text-sm text-[#CFB28C] max-w-md mx-auto">
            Você ainda não adicionou nenhum NFT à sua reserva. Explore as coleções da Kurio para
            encontrar edições raras.
          </p>
          <Link
            to="/"
            data-testid="cart-explore-link"
            className="h-10 px-6 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-xs uppercase inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Explorar catálogo</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-3">
            <div className="hidden sm:grid sm:grid-cols-12 px-4 pb-2 border-b border-[#3F2319] text-sm font-medium text-[#F5F1EB]">
              <div className="col-span-5">NFTs</div>
              <div className="col-span-2">Preço</div>
              <div className="col-span-3">Edições</div>
              <div className="col-span-2 text-right pr-6">Total</div>
            </div>

            {cart.items.map((item) => {
              const maxAllowed = Math.max(0, Math.min(item.available, item.maxPerOrder))
              const itemPriceChanged = item.issues.includes('PRICE_CHANGED')
              const itemSoldOut =
                item.issues.includes('SOLD_OUT') || item.issues.includes('EDITION_UNAVAILABLE')
              const itemLowStock = item.issues.includes('INSUFFICIENT_STOCK')

              return (
                <div
                  key={`${item.nftId}:${item.editionId}`}
                  data-testid={`cart-item-${item.nftId}-${item.editionId}`}
                  className={`rounded-[6px] bg-[#241612] border p-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center ${
                    item.issues.length > 0 ? 'border-[#F0805F]' : 'border-[#3F2319]'
                  }`}
                >
                  <div className="sm:col-span-5 flex items-center gap-3.5">
                    <Link
                      to="/nfts/$nftId"
                      params={{ nftId: item.nftId }}
                      className="w-[70px] h-[70px] rounded-[6px] overflow-hidden bg-[#140D0A] border border-[#3F2319] shrink-0"
                    >
                      <img
                        src={item.image.src}
                        alt={item.image.alt || item.name}
                        width={70}
                        height={70}
                        className="w-full h-full object-cover"
                      />
                    </Link>
                    <div className="min-w-0 space-y-0.5">
                      <Link
                        to="/nfts/$nftId"
                        params={{ nftId: item.nftId }}
                        className="text-base font-medium text-[#F5F1EB] hover:text-[#E89B55] block truncate"
                      >
                        {item.name}
                      </Link>
                      <p className="text-xs text-[#CFB28C]">
                        Criador: <span className="text-[#F5F1EB]">{item.creatorName}</span>
                      </p>
                      <p className="text-xs text-[#CFB28C]">
                        Edição: <span className="text-[#E89B55] font-bold">{item.editionName}</span>
                      </p>
                      {(itemSoldOut || itemLowStock) && (
                        <p
                          data-testid={`cart-stock-warning-${item.nftId}`}
                          className="text-xs font-bold text-[#F0805F]"
                        >
                          {itemSoldOut
                            ? 'Esgotado!'
                            : `Apenas ${item.available} disponível(is) em estoque`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-2 flex sm:flex-col justify-between sm:justify-center">
                    <span className="sm:hidden text-xs text-[#CFB28C]">Preço unitário:</span>
                    <div>
                      <span
                        data-testid={`cart-item-unit-price-${item.nftId}`}
                        className="text-sm sm:text-base font-medium text-[#CFB28C]"
                      >
                        {formatEth(item.unitPrice, { withSymbol: false })} ETH
                      </span>
                      {itemPriceChanged && item.previousUnitPrice && (
                        <span
                          data-testid={`cart-price-changed-${item.nftId}`}
                          className="block text-[11px] text-[#F0805F]"
                        >
                          Era {formatEth(item.previousUnitPrice, { withSymbol: false })} ETH
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-3 flex items-center justify-between sm:justify-start gap-2.5">
                    <span className="sm:hidden text-xs text-[#CFB28C]">Quantidade:</span>
                    <div className="inline-flex items-center gap-2.5">
                      <button
                        type="button"
                        data-testid={`cart-dec-${item.nftId}-${item.editionId}`}
                        aria-label={`Diminuir quantidade de ${item.name}`}
                        disabled={updateItem.isPending || item.quantity <= 1}
                        onClick={() =>
                          updateItem.mutate({
                            nftId: item.nftId,
                            editionId: item.editionId,
                            quantity: item.quantity - 1,
                          })
                        }
                        className="w-[26px] h-[26px] rounded-full bg-[#D28A4C] hover:bg-[#E89B55] disabled:opacity-40 text-[#140D0A] font-bold flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span
                        data-testid={`cart-qty-${item.nftId}-${item.editionId}`}
                        className="min-w-[20px] text-center text-base text-[#F5F1EB]"
                      >
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        data-testid={`cart-inc-${item.nftId}-${item.editionId}`}
                        aria-label={`Aumentar quantidade de ${item.name}`}
                        disabled={updateItem.isPending || item.quantity >= maxAllowed}
                        onClick={() =>
                          updateItem.mutate({
                            nftId: item.nftId,
                            editionId: item.editionId,
                            quantity: item.quantity + 1,
                          })
                        }
                        className="w-[26px] h-[26px] rounded-full bg-[#D28A4C] hover:bg-[#E89B55] disabled:opacity-40 text-[#140D0A] font-bold flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-3">
                    <span className="sm:hidden text-xs text-[#CFB28C]">Subtotal:</span>
                    <span
                      data-testid={`cart-line-total-${item.nftId}-${item.editionId}`}
                      className="text-base font-bold text-[#E89B55]"
                    >
                      {formatEth(item.lineTotal, { withSymbol: false })} ETH
                    </span>
                    <button
                      type="button"
                      data-testid={`cart-remove-${item.nftId}-${item.editionId}`}
                      aria-label={`Remover ${item.name} do carrinho`}
                      onClick={() =>
                        removeItem.mutate(
                          { nftId: item.nftId, editionId: item.editionId },
                          {
                            onSuccess: () => toast.info(`${item.name} removido do carrinho.`),
                          },
                        )
                      }
                      className="p-1.5 text-[#CFB28C] hover:text-[#F0805F] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <aside className="lg:col-span-4 rounded-[6px] bg-[#241612] border border-[#3F2319] p-5 space-y-5">
            <h2 className="text-lg font-bold text-[#F5F1EB] border-b border-[#3F2319] pb-2.5">
              Resumo da carteira
            </h2>

            <div className="space-y-2">
              <label htmlFor="coupon-input" className="block text-sm text-[#F5F1EB]">
                Código promocional
              </label>
              <form onSubmit={handleApplyCoupon} className="flex h-10">
                <input
                  id="coupon-input"
                  data-testid="coupon-input"
                  type="text"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value)
                    if (couponError) setCouponError(null)
                  }}
                  placeholder="Digite o código promocional aqui..."
                  className="flex-1 px-3 rounded-l-[6px] bg-[#140D0A] border border-r-0 border-[#D28A4C] text-xs text-[#F5F1EB] placeholder-[#B39463] focus:outline-none"
                />
                <button
                  type="submit"
                  data-testid="apply-coupon-btn"
                  disabled={applyCoupon.isPending}
                  className="px-4 rounded-r-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-xs uppercase transition-colors"
                >
                  Aplicar
                </button>
              </form>
              <p className="text-[11px] text-[#B39463]">
                Experimente: <code className="text-[#E89B55]">NFT10</code> (10%) ou{' '}
                <code className="text-[#E89B55]">WELCOME25</code> (25%)
              </p>

              {couponError && (
                <p
                  role="alert"
                  data-testid="coupon-error"
                  className="text-xs text-[#F0805F] font-medium"
                >
                  {couponError}
                </p>
              )}

              {cart.coupon && (
                <div
                  data-testid="active-coupon-badge"
                  className="flex items-center justify-between px-3 py-1.5 rounded bg-[#2F1D15] border border-[#D28A4C]/50 text-xs"
                >
                  <span className="flex items-center gap-1.5 text-[#E89B55] font-bold">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Cupom {cart.coupon.code} ativo ({cart.coupon.percentOff}%)</span>
                  </span>
                  <button
                    type="button"
                    data-testid="remove-coupon-btn"
                    aria-label="Remover cupom"
                    onClick={handleRemoveCoupon}
                    className="text-[#CFB28C] hover:text-[#F0805F]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3 text-sm border-t border-[#3F2319] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[#F5F1EB]">Subtotal</span>
                <span data-testid="cart-subtotal" className="font-medium text-[#F5F1EB]">
                  {formatEth(cart.summary.subtotal, { withSymbol: false })} ETH
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#F5F1EB]">Desconto do lançamento</span>
                <span data-testid="cart-discount" className="text-[#F5F1EB]">
                  (-) {formatEth(cart.summary.discount, { withSymbol: false })} ETH
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[#F5F1EB] block">Taxa de rede</span>
                  <span className="text-xs text-[#E89B55]">Taxa estimada</span>
                </div>
                <span data-testid="cart-fee" className="font-medium text-[#F5F1EB]">
                  {formatEth(cart.summary.networkFee, { withSymbol: false })} ETH
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-[#3F2319] pt-3 text-base font-bold">
                <span className="text-[#F5F1EB]">Total</span>
                <span data-testid="cart-total" className="text-lg text-[#E89B55]">
                  {formatEth(cart.summary.total, { withSymbol: false })} ETH
                </span>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                data-testid="proceed-checkout-btn"
                disabled={hasBlockingIssues}
                onClick={handleProceedToCheckout}
                className="w-full h-10 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] disabled:opacity-40 text-[#140D0A] font-bold text-sm uppercase transition-colors"
              >
                Conectar e finalizar
              </button>

              <Link
                to="/"
                className="block text-center text-sm text-[#E89B55] hover:underline py-1"
              >
                Continuar explorando
              </Link>
            </div>
          </aside>
        </div>
      )}

      {relatedNfts && relatedNfts.length > 0 && (
        <section aria-label="Colecionadores também viram" className="space-y-5 pt-4">
          <div className="border-b border-[#3F2319] pb-2">
            <h2 className="text-base font-bold text-[#E89B55]">Colecionadores também viram</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            {relatedNfts.slice(0, 5).map((item) => (
              <NftCard key={item.id} nft={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
