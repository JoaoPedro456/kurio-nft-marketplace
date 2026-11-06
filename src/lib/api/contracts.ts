/**
 * Contratos REST e de eventos compartilhados entre o cliente (Axios/Query/UI)
 * e a camada de mocks (MSW). Valores em ETH trafegam SEMPRE como string decimal.
 */

export type EthAmount = string // ex.: "0.125"
export type ISODate = string

// ---------- Erros ----------
export type ApiErrorCode =
  | 'VALIDATION_ERROR' // 422
  | 'UNAUTHENTICATED' // 401 (sem sessão)
  | 'SESSION_EXPIRED' // 401 (sessão expirada)
  | 'FORBIDDEN' // 403
  | 'NOT_FOUND' // 404
  | 'CONFLICT' // 409 genérico (ex.: e-mail já cadastrado)
  | 'AVAILABILITY_CONFLICT' // 409 estoque insuficiente
  | 'QUOTE_STALE' // 409 cotação desatualizada
  | 'IDEMPOTENCY_CONFLICT' // 409 chave reutilizada com conteúdo diferente
  | 'COUPON_INVALID' // 422
  | 'COUPON_EXPIRED' // 422
  | 'WALLET_REJECTED' // 403 usuário recusou a conexão
  | 'SERVICE_UNAVAILABLE' // 503 falha transitória
  | 'INTERNAL_ERROR' // 500

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** Erros por campo: { email: "Já cadastrado" } */
    fields?: Record<string, string>
    /** Dados extras (ex.: nova cotação quando QUOTE_STALE) */
    details?: unknown
  }
}

// ---------- Usuário / sessão ----------
export interface User {
  id: string
  name: string
  username: string
  email: string
  bio: string
  avatarUrl: string | null
  createdAt: ISODate
}

export interface Session {
  token: string
  expiresAt: ISODate
  user: User
}

export interface RegisterInput {
  name: string
  username: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface UpdateProfileInput {
  name: string
  username: string
  email: string
  bio: string
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

// ---------- NFTs ----------
export type NftCategory = 'art' | 'collectibles' | 'music' | 'photography' | 'gaming' | 'sports'
export type NftSort = 'recent' | 'price-asc' | 'price-desc' | 'popular'
export type Availability = 'all' | 'available' | 'sold-out'

export interface Creator {
  id: string
  name: string
  username: string
  avatarUrl: string
}

export interface NftEdition {
  id: string
  name: string // "Standard", "Gold"...
  price: EthAmount
  supply: number
  available: number
  /** Edição indisponível (pausada) independente do estoque */
  enabled: boolean
  maxPerOrder: number
}

export interface Nft {
  id: string
  slug: string
  name: string
  tokenId?: string
  description: string
  category: NftCategory
  collection: string
  network?: Network
  compareAtPrice?: EthAmount
  badge?: string
  rating?: number
  reviewsCount?: number
  attributes?: string[]
  creator: Creator
  images: { src: string; alt: string }[]
  editions: NftEdition[]
  /** Menor preço entre edições disponíveis */
  floorPrice: EthAmount
  totalAvailable: number
  likes: number
  createdAt: ISODate
  tags: string[]
  /** Versão monotônica do recurso; incrementa a cada alteração */
  version: number
}

export interface NftListQuery {
  q?: string
  category?: NftCategory[]
  network?: Network[]
  availability?: Availability
  minPrice?: string
  maxPrice?: string
  sort?: NftSort
  page?: number
  pageSize?: number
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// ---------- Favoritos ----------
export interface FavoritesResponse {
  nftIds: string[]
}

// ---------- Carrinho ----------
export interface CartItemInput {
  nftId: string
  editionId: string
  quantity: number
}

export type CartItemIssue = 'PRICE_CHANGED' | 'INSUFFICIENT_STOCK' | 'SOLD_OUT' | 'EDITION_UNAVAILABLE'

export interface CartItem {
  nftId: string
  editionId: string
  name: string
  editionName: string
  image: { src: string; alt: string }
  creatorName: string
  quantity: number
  unitPrice: EthAmount
  /** Preço no momento em que o item foi adicionado/confirmado pelo usuário */
  previousUnitPrice: EthAmount | null
  available: number
  maxPerOrder: number
  lineTotal: EthAmount
  issues: CartItemIssue[]
  nftVersion: number
}

export type CouponStatus = 'applied'
export interface AppliedCoupon {
  code: string
  description: string
  percentOff: number
}

export interface CartSummary {
  subtotal: EthAmount
  discount: EthAmount
  networkFee: EthAmount
  total: EthAmount
  itemCount: number
}

export interface Cart {
  id: string
  items: CartItem[]
  coupon: AppliedCoupon | null
  summary: CartSummary
  updatedAt: ISODate
}

// ---------- Cotação ----------
export type Network = 'ethereum' | 'polygon' | 'arbitrum'

export interface QuoteRequest {
  network: Network
}

export interface QuoteLine {
  nftId: string
  editionId: string
  name: string
  editionName: string
  image: { src: string; alt: string }
  quantity: number
  unitPrice: EthAmount
  lineTotal: EthAmount
}

export interface Quote {
  id: string
  network: Network
  lines: QuoteLine[]
  coupon: AppliedCoupon | null
  subtotal: EthAmount
  discount: EthAmount
  networkFee: EthAmount
  total: EthAmount
  issues: { nftId: string; editionId: string; issue: CartItemIssue }[]
  createdAt: ISODate
  expiresAt: ISODate
}

/** Detalhes do 409 QUOTE_STALE */
export interface QuoteStaleDetails {
  previous: Quote
  current: Quote
  changes: string[]
}

// ---------- Carteiras ----------
export type WalletKind = 'primary' | 'secondary'
export type WalletProvider = 'metamask' | 'coinbase' | 'walletconnect'

export interface Wallet {
  id: string
  kind: WalletKind
  label: string
  provider: WalletProvider
  address: string
  networks: Network[]
  createdAt: ISODate
  updatedAt: ISODate
}

export interface WalletInput {
  kind: WalletKind
  label: string
  provider: WalletProvider
  address: string
  networks: Network[]
}

export interface WalletConnection {
  walletId: string
  network: Network
  connectionId: string
  connectedAt: ISODate
}

// ---------- Pedidos ----------
export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface BuyerInfo {
  fullName: string
  email: string
  country: string
}

export interface CreateOrderInput {
  quoteId: string
  walletId: string
  connectionId: string
  network: Network
  buyer: BuyerInfo
}

export interface Order {
  id: string
  userId: string
  status: OrderStatus
  version: number
  /** Snapshot imutável no momento da criação */
  lines: QuoteLine[]
  coupon: AppliedCoupon | null
  subtotal: EthAmount
  discount: EthAmount
  networkFee: EthAmount
  total: EthAmount
  network: Network
  wallet: { id: string; label: string; address: string; provider: WalletProvider }
  buyer: BuyerInfo
  txHash: string | null
  explorerUrl: string | null
  declineReason: string | null
  createdAt: ISODate
  updatedAt: ISODate
}

// ---------- Eventos em tempo real ----------
export interface EventEnvelope<TType extends string, TData> {
  /** Identidade estável do evento (para deduplicação) */
  id: string
  type: TType
  resource: { type: 'nft' | 'order'; id: string }
  /** Versão do recurso após o evento */
  version: number
  occurredAt: ISODate
  /** Usuário dono do recurso (eventos privados) */
  userId?: string
  data: TData
}

export type NftUpdatedEvent = EventEnvelope<
  'nft.updated',
  { nft: Nft; previous: { floorPrice: EthAmount; editions: Pick<NftEdition, 'id' | 'price' | 'available' | 'enabled'>[] } }
>
export type OrderUpdatedEvent = EventEnvelope<'order.updated', { order: Order }>

export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent
