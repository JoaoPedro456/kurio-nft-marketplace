import { useEffect } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  X,
  XCircle,
} from 'lucide-react'
import { useOrderQuery } from '@/lib/hooks'
import { formatEth } from '@/lib/money'
import { useAuthSnapshot } from '@/lib/session'

export function OrderPage() {
  const { orderId } = useParams({ strict: false }) as { orderId: string }
  const navigate = useNavigate()
  const { session } = useAuthSnapshot()
  const { data: order, isLoading, isError, error } = useOrderQuery(orderId)

  useEffect(() => {
    if (!session) {
      navigate({
        to: '/login',
        search: { redirect: `/orders/${orderId}` },
        replace: true,
      })
    }
  }, [session, orderId, navigate])

  if (!session) return null

  return (
    <div className="relative min-h-[75vh] max-w-[1200px] mx-auto px-4 sm:px-6 py-10 flex items-center justify-center">
      <div
        data-testid="order-receipt-card"
        className="w-full max-w-[578px] rounded-[8px] bg-[#241612] border border-[#3F2319] overflow-hidden shadow-2xl"
      >
        {isLoading ? (
          <div data-testid="order-loading" className="p-10 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-[#E89B55] animate-spin mx-auto" />
            <p className="text-sm font-bold text-[#F5F1EB]">
              Consultando estado da transação na blockchain...
            </p>
          </div>
        ) : isError || !order ? (
          <div role="alert" data-testid="order-error" className="p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-[#F0805F] mx-auto" />
            <h1 className="text-lg font-bold text-[#F5F1EB]">Pedido não encontrado</h1>
            <p className="text-xs text-[#CFB28C]">
              {error instanceof Error ? error.message : 'Não foi possível localizar esta transação.'}
            </p>
            <Link
              to="/"
              className="h-10 px-6 rounded-[6px] bg-[#D28A4C] text-[#140D0A] font-bold text-xs uppercase inline-flex items-center justify-center"
            >
              Voltar ao início
            </Link>
          </div>
        ) : (
          <>
            <div className="relative bg-[#38220F] border-b border-[#D28A4C]/25 px-6 py-6 text-center space-y-2">
              <Link
                to="/"
                aria-label="Fechar recibo e voltar ao início"
                className="absolute top-3.5 right-3.5 p-1.5 text-[#CFB28C] hover:text-[#F5F1EB]"
              >
                <X className="w-4 h-4" />
              </Link>

              {order.status === 'confirmed' && (
                <>
                  <img
                    src="/images/ui/thank-you.svg"
                    alt="Confirmação Kurio"
                    width={65}
                    height={65}
                    className="w-16 h-16 mx-auto object-contain"
                  />
                  <h1
                    data-testid="order-confirmed-heading"
                    className="text-base sm:text-lg font-bold text-[#CFB28C]"
                  >
                    Seus NFTs agora estão na sua carteira
                  </h1>
                </>
              )}

              {order.status === 'pending' && (
                <div data-testid="order-pending-banner" className="py-2 space-y-2">
                  <Loader2 className="w-12 h-12 text-[#E89B55] animate-spin mx-auto" />
                  <h1 className="text-base sm:text-lg font-bold text-[#F5F1EB]">
                    Aguardando confirmação on-chain...
                  </h1>
                  <p className="text-xs text-[#CFB28C]">
                    Sua transação está sendo validada na rede {order.network.toUpperCase()}. Esta
                    tela atualizará automaticamente via Socket.IO.
                  </p>
                </div>
              )}

              {order.status === 'declined' && (
                <div role="alert" data-testid="order-declined-banner" className="py-2 space-y-2">
                  <XCircle className="w-12 h-12 text-[#F0805F] mx-auto" />
                  <h1 className="text-base sm:text-lg font-bold text-[#F0805F]">
                    Transação recusada pela rede
                  </h1>
                  <p className="text-xs text-[#CFB28C]">
                    {order.declineReason ??
                      'A assinatura expirou ou o limite de gás foi insuficiente. As reservas foram liberadas.'}
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-b border-[#D28A4C]/20 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[#CFB28C] block">ID da transação</span>
                <strong data-testid="order-id-display" className="text-[#F5F1EB] font-bold">
                  {order.id}
                </strong>
              </div>
              <div className="sm:border-l sm:border-[#D28A4C]/20 sm:pl-3">
                <span className="text-[#CFB28C] block">Data</span>
                <strong className="text-[#F5F1EB] font-bold">
                  {new Date(order.createdAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </div>
              <div className="sm:border-l sm:border-[#D28A4C]/20 sm:pl-3">
                <span className="text-[#CFB28C] block">Total</span>
                <strong data-testid="order-total-display" className="text-[#E89B55] font-bold">
                  {formatEth(order.total, { withSymbol: false })} ETH
                </strong>
              </div>
              <div className="sm:border-l sm:border-[#D28A4C]/20 sm:pl-3">
                <span className="text-[#CFB28C] block">Carteira</span>
                <strong className="text-[#F5F1EB] font-bold truncate block">
                  {order.wallet.label} ({order.network.toUpperCase()})
                </strong>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-3">
                <h2 className="text-base font-bold text-[#F5F1EB]">Detalhes da transação</h2>

                <div className="grid grid-cols-12 border-b border-[#D28A4C]/25 pb-2 text-xs sm:text-sm font-medium text-[#F5F1EB]">
                  <div className="col-span-7">NFTs</div>
                  <div className="col-span-2 text-center">Edições</div>
                  <div className="col-span-3 text-right">Subtotal</div>
                </div>

                <div className="space-y-2.5">
                  {order.lines.map((line) => (
                    <div
                      key={`${line.nftId}:${line.editionId}`}
                      className="rounded-[6px] bg-[#140D0A]/60 border border-[#3F2319] p-3 grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-7 flex items-center gap-3 min-w-0">
                        <img
                          src={line.image.src}
                          alt={line.image.alt || line.name}
                          width={56}
                          height={56}
                          className="w-14 h-14 rounded-[6px] object-cover shrink-0 border border-[#3F2319]"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#F5F1EB] truncate">
                            {line.name}
                          </p>
                          <p className="text-xs text-[#E89B55]">Edição {line.editionName}</p>
                        </div>
                      </div>
                      <div className="col-span-2 text-center text-xs text-[#CFB28C]">
                        (x{line.quantity})
                      </div>
                      <div className="col-span-3 text-right text-sm sm:text-base font-bold text-[#F5F1EB]">
                        {formatEth(line.lineTotal, { withSymbol: false })} ETH
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t border-[#3F2319] pt-4 text-sm">
                <div className="flex items-center justify-between text-[#CFB28C]">
                  <span>Taxa de rede</span>
                  <span className="font-medium text-[#F5F1EB]">
                    {formatEth(order.networkFee, { withSymbol: false })} ETH
                  </span>
                </div>
                {Number(order.discount) > 0 && (
                  <div className="flex items-center justify-between text-[#CFB28C]">
                    <span>Desconto aplicado</span>
                    <span className="text-[#4E9B6F]">
                      (-) {formatEth(order.discount, { withSymbol: false })} ETH
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-[#D28A4C]/25 pt-3 text-base font-bold">
                  <span className="text-[#F5F1EB]">Total</span>
                  <span className="text-lg text-[#E89B55]">
                    {formatEth(order.total, { withSymbol: false })} ETH
                  </span>
                </div>
              </div>

              {order.status === 'confirmed' && (
                <div className="space-y-4 pt-2 text-center">
                  <p className="text-xs sm:text-sm text-[#CFB28C] leading-5">
                    Sua compra foi confirmada na blockchain. Você receberá em instantes a
                    confirmação da transação e os detalhes de acesso aos seus NFTs na carteira
                    conectada (
                    <code className="text-[#E89B55]">
                      {(order.txHash ?? '0x9988776655443322').slice(0, 14)}...
                    </code>
                    ).
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <a
                      href={order.explorerUrl ?? `https://etherscan.io/tx/${order.txHash ?? ''}`}
                      target="_blank"
                      rel="noreferrer"
                      data-testid="view-etherscan-btn"
                      className="h-11 px-6 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-sm uppercase inline-flex items-center gap-2 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ver no Etherscan</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <Link
                      to="/"
                      className="h-11 px-5 rounded-[6px] border border-[#3F2319] hover:border-[#D28A4C] text-xs font-bold uppercase text-[#F5F1EB] inline-flex items-center"
                    >
                      Continuar colecionando
                    </Link>
                  </div>
                </div>
              )}

              {order.status === 'declined' && (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Link
                    to="/nfts/$nftId"
                    params={{ nftId: order.lines[0]?.nftId ?? 'nft-1' }}
                    data-testid="order-retry-link"
                    className="h-11 px-6 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-xs uppercase inline-flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Tentar compra novamente</span>
                  </Link>
                  <Link
                    to="/"
                    className="h-11 px-5 rounded-[6px] border border-[#3F2319] text-xs font-bold uppercase text-[#CFB28C] hover:text-[#F5F1EB] inline-flex items-center"
                  >
                    Voltar ao início
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
