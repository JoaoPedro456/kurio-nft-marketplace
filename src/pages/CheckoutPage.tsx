import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wallet as WalletIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, AppApiError } from '@/lib/api/client'
import type { BuyerInfo, Network, Quote, QuoteStaleDetails } from '@/lib/api/contracts'
import {
  useCartQuery,
  useQuoteQuery,
  useWalletMutations,
  useWalletsQuery,
} from '@/lib/hooks'
import { formatEth } from '@/lib/money'
import { queryClient, queryKeys } from '@/lib/query'
import { seedResourceVersion } from '@/lib/realtime'
import {
  clearCheckoutDraft,
  loadCheckoutDraft,
  saveCheckoutDraft,
  savePendingOrderSubmission,
  sessionStore,
  useAuthSnapshot,
} from '@/lib/session'

export function CheckoutPage() {
  const navigate = useNavigate()
  const { session, walletConnection } = useAuthSnapshot()
  const { data: cart, isLoading: cartLoading } = useCartQuery()
  const { data: wallets } = useWalletsQuery()
  const { connectWallet } = useWalletMutations()

  const savedDraft = loadCheckoutDraft()

  const [buyer, setBuyer] = useState<BuyerInfo>({
    fullName: savedDraft?.buyer.fullName || session?.user.name || 'Ana Colecionadora',
    email: savedDraft?.buyer.email || session?.user.email || 'ana@nft.test',
    country: savedDraft?.buyer.country || 'Brasil',
  })
  const [username, setUsername] = useState(session?.user.username ?? 'ana_kurio')
  const [network, setNetwork] = useState<Network>(savedDraft?.network ?? 'ethereum')
  const [selectedWalletId, setSelectedWalletId] = useState<string>(savedDraft?.walletId ?? '')
  const [walletMode, setWalletMode] = useState<'bundle' | 'metamask' | 'coinbase'>('bundle')
  const [ensName, setEnsName] = useState(savedDraft?.ensName ?? 'ana.kurio.eth')
  const [referralCode, setReferralCode] = useState(savedDraft?.referralCode ?? 'KURIOVIP')
  const [note, setNote] = useState(savedDraft?.note ?? '')
  const [useSecondaryWallet, setUseSecondaryWallet] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [activeQuote, setActiveQuote] = useState<Quote | null>(null)
  const [staleQuoteModal, setStaleQuoteModal] = useState<{
    oldTotal: string
    newQuote: Quote
  } | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<{
    code: string
    message: string
  } | null>(null)
  const idempotencyKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!session) {
      navigate({
        to: '/login',
        search: { redirect: '/checkout' },
        replace: true,
      })
    }
  }, [session, navigate])

  useEffect(() => {
    if (wallets && wallets.length > 0 && !selectedWalletId) {
      const primary = wallets.find((w) => w.kind === 'primary') ?? wallets[0]
      if (primary) {
        setSelectedWalletId(primary.id)
      }
    }
  }, [wallets, selectedWalletId])

  useEffect(() => {
    if (!session) return
    saveCheckoutDraft({
      buyer,
      network,
      walletId: selectedWalletId,
      ensName,
      referralCode,
      note,
    })
  }, [buyer, network, selectedWalletId, ensName, referralCode, note, session])

  const {
    data: fetchedQuote,
    isLoading: quoteLoading,
    refetch: refetchQuote,
  } = useQuoteQuery(
    network,
    cart?.updatedAt ?? '',
    Boolean(session && cart && cart.items.length > 0),
  )

  useEffect(() => {
    if (fetchedQuote && !idempotencyKeyRef.current) {
      setActiveQuote(fetchedQuote)
    }
  }, [fetchedQuote])

  const selectedWallet = wallets?.find((w) => w.id === selectedWalletId) ?? wallets?.[0]
  const isWalletConnected = Boolean(
    walletConnection &&
      selectedWallet &&
      walletConnection.walletId === selectedWallet.id &&
      walletConnection.network === network,
  )

  const handleConnectWallet = async () => {
    if (!selectedWallet) {
      toast.error('Nenhuma carteira encontrada. Cadastre uma carteira primeiro.')
      return
    }
    try {
      const conn = await connectWallet.mutateAsync({
        id: selectedWallet.id,
        network,
      })
      sessionStore.setWalletConnection(conn)
      toast.success(`Carteira ${selectedWallet.label} conectada na rede ${network.toUpperCase()}!`)
    } catch (err) {
      const msg =
        err instanceof AppApiError ? err.message : 'Falha ao conectar a carteira.'
      toast.error(msg)
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!buyer.fullName || buyer.fullName.trim().length < 2) {
      errors.fullName = 'Informe o nome de exibição.'
    }
    if (!buyer.email || !buyer.email.includes('@')) {
      errors.email = 'Informe um e-mail válido.'
    }
    if (!buyer.country || buyer.country.trim().length < 2) {
      errors.country = 'Informe o país ou jurisdição.'
    }
    if (!selectedWallet) {
      errors.wallet = 'Selecione uma carteira válida.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submitOrderWithQuote = async (quoteToUse: Quote) => {
    if (!session || !selectedWallet) return
    if (!validateForm()) {
      toast.error('Revise os campos obrigatórios do perfil do colecionador.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      let conn = walletConnection
      if (
        !conn ||
        conn.walletId !== selectedWallet.id ||
        conn.network !== network
      ) {
        conn = await connectWallet.mutateAsync({
          id: selectedWallet.id,
          network,
        })
        sessionStore.setWalletConnection(conn)
      }

      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = `idem-${crypto.randomUUID()}`
      }
      const idempotencyKey = idempotencyKeyRef.current

      savePendingOrderSubmission({
        idempotencyKey,
        quoteId: quoteToUse.id,
        walletId: selectedWallet.id,
        connectionId: conn.connectionId,
        network,
        buyer,
        createdAt: new Date().toISOString(),
      })

      const order = await api.createOrder(
        {
          quoteId: quoteToUse.id,
          walletId: selectedWallet.id,
          connectionId: conn.connectionId,
          network,
          buyer,
        },
        idempotencyKey,
      )

      seedResourceVersion('order', order.id, order.version)
      queryClient.setQueryData(queryKeys.orders.detail(session.user.id, order.id), order)
      queryClient.invalidateQueries({ queryKey: ['cart'] })

      idempotencyKeyRef.current = null
      savePendingOrderSubmission(null)
      clearCheckoutDraft()

      navigate({
        to: '/orders/$orderId',
        params: { orderId: order.id },
      })
    } catch (err) {
      if (err instanceof AppApiError) {
        if (err.code === 'SESSION_EXPIRED' || err.status === 401) {
          toast.error('Sua sessão expirou. Faça login novamente para concluir a compra.')
          navigate({
            to: '/login',
            search: { redirect: '/checkout' },
          })
          return
        }

        if (err.code === 'QUOTE_STALE') {
          const details = err.details as QuoteStaleDetails | undefined
          if (details?.current) {
            idempotencyKeyRef.current = `idem-${crypto.randomUUID()}`
            setStaleQuoteModal({
              oldTotal: quoteToUse.total,
              newQuote: details.current,
            })
            setActiveQuote(details.current)
            return
          }
        }

        setSubmitError({
          code: err.code,
          message: err.message,
        })
        toast.error(err.message)
      } else {
        setSubmitError({
          code: 'NETWORK_ERROR',
          message: 'Erro inesperado ao enviar o pedido. Você pode tentar novamente com segurança.',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!session) {
    return null
  }

  if (!cartLoading && (!cart || cart.items.length === 0) && !activeQuote && !isSubmitting && !submitError) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16">
        <div className="max-w-lg mx-auto rounded-[8px] bg-[#241612] border border-[#3F2319] p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-[#E89B55] mx-auto" />
          <h1 className="text-xl font-bold text-[#F5F1EB]">Nenhum item para finalizar</h1>
          <p className="text-xs sm:text-sm text-[#CFB28C]">
            Adicione ao menos um NFT ao carrinho antes de acessar a tela de pagamento.
          </p>
          <Link
            to="/"
            className="h-10 px-6 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-xs uppercase inline-flex items-center justify-center transition-colors"
          >
            Voltar ao catálogo
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 space-y-10 pb-16">
      <nav aria-label="Breadcrumb" className="text-sm text-[#CFB28C] flex items-center gap-2">
        <Link to="/" className="font-bold text-[#F5F1EB] hover:text-[#E89B55]">
          Início
        </Link>
        <span>/</span>
        <Link to="/" className="hover:text-[#F5F1EB]">
          Mercado
        </Link>
        <span>/</span>
        <span className="text-[#E89B55]">Pagamento</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section aria-label="Perfil do colecionador" className="lg:col-span-7 space-y-6">
          <h1 className="text-lg font-bold text-[#F5F1EB]">Perfil do colecionador</h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label htmlFor="checkout-fullname" className="block text-sm text-[#F5F1EB]">
                Nome de exibição <span className="text-[#F0805F]">*</span>
              </label>
              <input
                id="checkout-fullname"
                data-testid="checkout-fullname"
                type="text"
                value={buyer.fullName}
                onChange={(e) => setBuyer((b) => ({ ...b, fullName: e.target.value }))}
                className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
              />
              {fieldErrors.fullName && (
                <p className="text-xs text-[#F0805F]">{fieldErrors.fullName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="checkout-username" className="block text-sm text-[#F5F1EB]">
                Nome de usuário <span className="text-[#F0805F]">*</span>
              </label>
              <input
                id="checkout-username"
                data-testid="checkout-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="checkout-network" className="block text-sm text-[#F5F1EB]">
                Rede <span className="text-[#F0805F]">*</span>
              </label>
              <select
                id="checkout-network"
                data-testid="checkout-network"
                value={network}
                onChange={(e) => setNetwork(e.target.value as Network)}
                className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
              >
                <option value="ethereum">Ethereum Mainnet (ERC-721)</option>
                <option value="polygon">Polygon POS (MATIC)</option>
                <option value="arbitrum">Arbitrum One</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="checkout-country" className="block text-sm text-[#F5F1EB]">
                País / Jurisdição <span className="text-[#F0805F]">*</span>
              </label>
              <input
                id="checkout-country"
                data-testid="checkout-country"
                type="text"
                value={buyer.country}
                onChange={(e) => setBuyer((b) => ({ ...b, country: e.target.value }))}
                className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
              />
              {fieldErrors.country && (
                <p className="text-xs text-[#F0805F]">{fieldErrors.country}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="checkout-wallet-select" className="block text-sm text-[#F5F1EB]">
                Endereço da carteira <span className="text-[#F0805F]">*</span>
              </label>
              <select
                id="checkout-wallet-select"
                data-testid="checkout-wallet-select"
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-xs sm:text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
              >
                {wallets?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label} — {w.address.slice(0, 10)}...{w.address.slice(-6)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="checkout-secondary" className="block text-sm text-[#F5F1EB]">
                Carteira secundária (opcional)
              </label>
              <input
                id="checkout-secondary"
                type="text"
                placeholder="ENS ou endereço de carteira de backup (opcional)"
                className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] placeholder-[#B39463] focus:border-[#D28A4C] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="checkout-wallet-type" className="block text-sm text-[#F5F1EB]">
                Tipo de carteira <span className="text-[#F0805F]">*</span>
              </label>
              <select
                id="checkout-wallet-type"
                className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
              >
                <option value="metamask">MetaMask / Injected Web3</option>
                <option value="walletconnect">WalletConnect v2</option>
                <option value="coinbase">Coinbase Smart Wallet</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="checkout-referral" className="block text-sm text-[#F5F1EB]">
                Código de indicação <span className="text-[#F0805F]">*</span>
              </label>
              <input
                id="checkout-referral"
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="checkout-email" className="block text-sm text-[#F5F1EB]">
                E-mail <span className="text-[#F0805F]">*</span>
              </label>
              <input
                id="checkout-email"
                data-testid="checkout-email"
                type="email"
                value={buyer.email}
                onChange={(e) => setBuyer((b) => ({ ...b, email: e.target.value }))}
                className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
              />
              {fieldErrors.email && (
                <p className="text-xs text-[#F0805F]">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="checkout-ens" className="block text-sm text-[#F5F1EB]">
                Nome ENS <span className="text-[#F0805F]">*</span>
              </label>
              <div className="flex gap-2">
                <span className="h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#CFB28C] inline-flex items-center">
                  ETH
                </span>
                <input
                  id="checkout-ens"
                  type="text"
                  value={ensName}
                  onChange={(e) => setEnsName(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm font-medium text-[#F5F1EB]">
            <input
              type="checkbox"
              checked={useSecondaryWallet}
              onChange={(e) => setUseSecondaryWallet(e.target.checked)}
              className="w-4 h-4 accent-[#D28A4C] rounded"
            />
            <span>Usar outra carteira?</span>
          </label>

          {useSecondaryWallet && (
            <div className="p-3.5 rounded-[6px] bg-[#241612] border border-[#3F2319] flex items-center justify-between text-xs text-[#CFB28C]">
              <span>Deseja adicionar ou editar carteiras salvas na sua conta?</span>
              <Link to="/account/wallets" className="text-[#E89B55] font-bold hover:underline">
                Gerenciar carteiras
              </Link>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="checkout-note" className="block text-sm text-[#F5F1EB]">
              Observação do colecionador (opcional)
            </label>
            <textarea
              id="checkout-note"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Adicione instruções de custódia, transferência ou mensagem para o criador..."
              className="w-full p-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] placeholder-[#B39463] focus:border-[#D28A4C] focus:outline-none"
            />
          </div>
        </section>

        <aside aria-label="Resumo do pedido e carteira" className="lg:col-span-5 space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[#F5F1EB]">Seus NFTs</h2>

            <div className="flex items-center justify-between border-b border-[#3F2319] pb-2 text-sm font-medium text-[#F5F1EB]">
              <span>NFTs</span>
              <span>Subtotal</span>
            </div>

            <div className="space-y-2.5">
              {cart?.items.map((item) => (
                <div
                  key={`${item.nftId}:${item.editionId}`}
                  data-testid={`checkout-item-${item.nftId}`}
                  className="rounded-[6px] bg-[#241612] border border-[#3F2319] p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={item.image.src}
                      alt={item.image.alt || item.name}
                      width={60}
                      height={60}
                      className="w-[60px] h-[60px] rounded-[6px] object-cover shrink-0 border border-[#3F2319]"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#F5F1EB] truncate">{item.name}</p>
                      <p className="text-xs text-[#CFB28C]">
                        Criador: <span className="text-[#F5F1EB]">{item.creatorName}</span>
                      </p>
                      <p className="text-xs text-[#CFB28C]">
                        Edição: <span className="text-[#E89B55]">{item.editionName}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-[#CFB28C] block">(x{item.quantity})</span>
                    <span className="text-base font-bold text-[#E89B55]">
                      {formatEth(item.lineTotal, { withSymbol: false })} ETH
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-right text-xs text-[#F5F1EB]">
              Tem um código promocional?{' '}
              <Link to="/cart" className="text-[#E89B55] font-medium hover:underline">
                Clique aqui
              </Link>
            </div>

            <div className="space-y-3 border-t border-[#3F2319] pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#F5F1EB]">Subtotal</span>
                <span data-testid="checkout-subtotal" className="font-medium text-[#F5F1EB]">
                  {formatEth(activeQuote?.subtotal ?? cart?.summary.subtotal ?? '0', {
                    withSymbol: false,
                  })}{' '}
                  ETH
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#F5F1EB]">Desconto do lançamento</span>
                <span data-testid="checkout-discount" className="text-[#F5F1EB]">
                  (-){' '}
                  {formatEth(activeQuote?.discount ?? cart?.summary.discount ?? '0', {
                    withSymbol: false,
                  })}{' '}
                  ETH
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[#F5F1EB] block">Taxa de rede ({network.toUpperCase()})</span>
                  <span className="text-xs text-[#E89B55]">Taxa estimada</span>
                </div>
                <span data-testid="checkout-network-fee" className="font-medium text-[#F5F1EB]">
                  {formatEth(activeQuote?.networkFee ?? cart?.summary.networkFee ?? '0', {
                    withSymbol: false,
                  })}{' '}
                  ETH
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-[#3F2319] pt-3 text-base font-bold">
                <span className="text-[#F5F1EB]">Total</span>
                <span data-testid="checkout-total" className="text-lg text-[#E89B55]">
                  {formatEth(activeQuote?.total ?? cart?.summary.total ?? '0', {
                    withSymbol: false,
                  })}{' '}
                  ETH
                </span>
              </div>

              {activeQuote && (
                <div className="flex items-center justify-between text-[11px] text-[#B39463]">
                  <span>Cotação #{activeQuote.id.slice(0, 12)}</span>
                  <button
                    type="button"
                    data-testid="refresh-quote-btn"
                    onClick={() => refetchQuote()}
                    className="inline-flex items-center gap-1 text-[#E89B55] hover:underline"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Atualizar cotação</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="text-base font-bold text-[#F5F1EB]">Carteira e rede</h3>

            <label
              className={`flex items-center gap-3 p-3 rounded-[6px] bg-[#241612] border cursor-pointer transition-colors ${
                walletMode === 'bundle' ? 'border-[#D28A4C]' : 'border-[#3F2319]'
              }`}
            >
              <input
                type="radio"
                name="walletMode"
                checked={walletMode === 'bundle'}
                onChange={() => setWalletMode('bundle')}
                className="accent-[#D28A4C]"
              />
              <span className="text-xs font-bold tracking-wider text-[#E89B55]">
                METAMASK • WALLETCONNECT • COINBASE
              </span>
            </label>

            <label
              className={`flex items-center gap-3 p-3 rounded-[6px] bg-[#241612] border cursor-pointer transition-colors ${
                walletMode === 'metamask' ? 'border-[#D28A4C]' : 'border-[#3F2319]'
              }`}
            >
              <input
                type="radio"
                name="walletMode"
                checked={walletMode === 'metamask'}
                onChange={() => setWalletMode('metamask')}
                className="accent-[#D28A4C]"
              />
              <span className="text-sm text-[#CFB28C]">MetaMask</span>
            </label>

            <label
              className={`flex items-center gap-3 p-3 rounded-[6px] bg-[#241612] border cursor-pointer transition-colors ${
                walletMode === 'coinbase' ? 'border-[#D28A4C]' : 'border-[#3F2319]'
              }`}
            >
              <input
                type="radio"
                name="walletMode"
                checked={walletMode === 'coinbase'}
                onChange={() => setWalletMode('coinbase')}
                className="accent-[#D28A4C]"
              />
              <span className="text-sm text-[#CFB28C]">Coinbase Wallet</span>
            </label>

            <div className="p-3 rounded-[6px] bg-[#241612] border border-[#3F2319] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                {isWalletConnected ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#4E9B6F]" />
                    <span data-testid="wallet-connection-status" className="text-[#4E9B6F] font-bold">
                      Carteira conectada ({network.toUpperCase()})
                    </span>
                  </>
                ) : (
                  <>
                    <WalletIcon className="w-4 h-4 text-[#E89B55]" />
                    <span data-testid="wallet-connection-status" className="text-[#CFB28C]">
                      Pronta para assinatura on-chain
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                data-testid="connect-wallet-btn"
                disabled={connectWallet.isPending}
                onClick={handleConnectWallet}
                className="h-8 px-3 rounded bg-[#2F1D15] border border-[#D28A4C]/50 hover:border-[#D28A4C] text-xs font-bold text-[#E89B55] transition-colors"
              >
                {isWalletConnected ? 'Reconectar' : 'Conectar carteira'}
              </button>
            </div>

            {submitError && (
              <div
                role="alert"
                data-testid="checkout-submit-error"
                className="rounded-[6px] bg-[#38220F] border border-[#F0805F] p-4 space-y-3"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-[#F0805F] shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-[#F5F1EB]">
                      Não foi possível confirmar a transação ({submitError.code})
                    </p>
                    <p className="text-[#CFB28C]">{submitError.message}</p>
                    <p className="text-[#E89B55]">
                      Sua chave de idempotência está preservada: tentar novamente não duplicará a
                      cobrança nem o pedido.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="checkout-retry-submit-btn"
                  disabled={isSubmitting || !activeQuote}
                  onClick={() => activeQuote && submitOrderWithQuote(activeQuote)}
                  className="w-full h-9 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-xs uppercase inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tentar novamente com segurança</span>
                </button>
              </div>
            )}

            <button
              type="button"
              data-testid="confirm-purchase-btn"
              disabled={isSubmitting || quoteLoading || !activeQuote}
              onClick={() => activeQuote && submitOrderWithQuote(activeQuote)}
              className="w-full h-11 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] disabled:opacity-50 text-[#140D0A] font-bold text-sm uppercase flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processando assinatura...</span>
                </>
              ) : (
                <span>Confirmar compra</span>
              )}
            </button>
          </div>
        </aside>
      </div>

      {staleQuoteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="stale-quote-title"
          data-testid="stale-quote-modal"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-[8px] bg-[#241612] border border-[#D28A4C] p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-[#E89B55] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 id="stale-quote-title" className="text-lg font-bold text-[#F5F1EB]">
                  Cotação atualizada em tempo real
                </h2>
                <p className="text-xs text-[#CFB28C] leading-5">
                  O preço de um NFT ou a taxa de gás da rede mudou desde a última cotação.
                  Confirme os novos valores antes de finalizar.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-[6px] bg-[#140D0A] border border-[#3F2319] space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#CFB28C]">
                <span>Total anterior:</span>
                <span className="line-through">
                  {formatEth(staleQuoteModal.oldTotal, { withSymbol: false })} ETH
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-[#E89B55]">
                <span>Novo total atualizado:</span>
                <span data-testid="stale-quote-new-total">
                  {formatEth(staleQuoteModal.newQuote.total, { withSymbol: false })} ETH
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                data-testid="cancel-new-quote-btn"
                onClick={() => setStaleQuoteModal(null)}
                className="h-10 px-4 rounded-[6px] border border-[#3F2319] text-xs font-bold text-[#CFB28C] hover:text-[#F5F1EB]"
              >
                Revisar primeiro
              </button>
              <button
                type="button"
                data-testid="accept-new-quote-btn"
                onClick={() => {
                  const accepted = staleQuoteModal.newQuote
                  setStaleQuoteModal(null)
                  submitOrderWithQuote(accepted)
                }}
                className="h-10 px-5 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-xs uppercase inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Aceitar e confirmar compra</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
