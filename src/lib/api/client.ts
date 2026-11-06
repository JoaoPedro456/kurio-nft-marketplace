import axios, { AxiosError } from 'axios'
import type {
  ApiErrorBody,
  ApiErrorCode,
  Cart,
  CartItemInput,
  ChangePasswordInput,
  CreateOrderInput,
  FavoritesResponse,
  LoginInput,
  Network,
  Nft,
  NftListQuery,
  Order,
  Paginated,
  Quote,
  QuoteRequest,
  RegisterInput,
  Session,
  UpdateProfileInput,
  User,
  Wallet,
  WalletConnection,
  WalletInput,
} from '@/lib/api/contracts'
import { ensureMocksStarted } from '@/lib/mocks-ready'
import { sessionStore } from '@/lib/session'

export class AppApiError extends Error {
  status: number
  code: ApiErrorCode
  fields?: Record<string, string>
  details?: unknown
  isTimeout: boolean
  isNetworkError: boolean

  constructor(opts: {
    status: number
    code: ApiErrorCode
    message: string
    fields?: Record<string, string>
    details?: unknown
    isTimeout?: boolean
    isNetworkError?: boolean
  }) {
    super(opts.message)
    this.name = 'AppApiError'
    this.status = opts.status
    this.code = opts.code
    this.fields = opts.fields
    this.details = opts.details
    this.isTimeout = Boolean(opts.isTimeout)
    this.isNetworkError = Boolean(opts.isNetworkError)
  }
}

export const httpClient = axios.create({
  baseURL: '/api',
  timeout: 4500,
  headers: {
    'Content-Type': 'application/json',
  },
})

httpClient.interceptors.request.use(async (config) => {
  await ensureMocksStarted()
  const token = sessionStore.getToken()
  const guestCartId = sessionStore.getGuestCartId()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  if (guestCartId) {
    config.headers.set('X-Cart-Id', guestCartId)
  }
  return config
})

let onSessionExpiredCallback: (() => void) | null = null

export function setOnSessionExpired(cb: (() => void) | null) {
  onSessionExpiredCallback = cb
}

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const axErr = error as AxiosError<ApiErrorBody>
      const isTimeout = axErr.code === 'ECONNABORTED' || axErr.message.toLowerCase().includes('timeout')
      if (isTimeout) {
        return Promise.reject(
          new AppApiError({
            status: 408,
            code: 'SERVICE_UNAVAILABLE',
            message: 'A requisição demorou além do esperado (timeout). Verifique o status ou tente novamente.',
            isTimeout: true,
          }),
        )
      }
      if (!axErr.response) {
        return Promise.reject(
          new AppApiError({
            status: 0,
            code: 'SERVICE_UNAVAILABLE',
            message: 'Sem conexão com o servidor. Verifique sua rede e tente novamente.',
            isNetworkError: true,
          }),
        )
      }
      const status = axErr.response.status
      const body = axErr.response.data?.error
      const code: ApiErrorCode = body?.code ?? (status === 401 ? 'UNAUTHENTICATED' : status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR')
      const message = body?.message ?? 'Ocorreu um erro inesperado ao processar sua solicitação.'

      if (status === 401 && code === 'SESSION_EXPIRED') {
        sessionStore.markSessionExpired(message)
        onSessionExpiredCallback?.()
      }

      return Promise.reject(
        new AppApiError({
          status,
          code,
          message,
          fields: body?.fields,
          details: body?.details,
        }),
      )
    }
    return Promise.reject(
      new AppApiError({
        status: 500,
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Erro desconhecido.',
      }),
    )
  },
)

export const api = {
  // Auth
  async register(input: RegisterInput, guestCartId?: string): Promise<Session> {
    const { data } = await httpClient.post<Session>('/auth/register', input)
    if (guestCartId) {
      await httpClient
        .post<Cart>(
          '/cart/merge',
          { guestCartId },
          { headers: { Authorization: `Bearer ${data.token}` } },
        )
        .catch(() => null)
    }
    sessionStore.setSession(data)
    return data
  },

  async login(input: LoginInput, guestCartId?: string): Promise<Session> {
    const { data } = await httpClient.post<Session>('/auth/login', input)
    if (guestCartId) {
      await httpClient
        .post<Cart>(
          '/cart/merge',
          { guestCartId },
          { headers: { Authorization: `Bearer ${data.token}` } },
        )
        .catch(() => null)
    }
    sessionStore.setSession(data)
    return data
  },

  async getSession(): Promise<Session> {
    const { data } = await httpClient.get<Session>('/auth/session')
    sessionStore.setSession(data)
    return data
  },

  async logout(): Promise<void> {
    try {
      await httpClient.post('/auth/logout')
    } finally {
      sessionStore.setSession(null)
      sessionStore.rotateGuestCartId()
    }
  },

  // Profile
  async getProfile(): Promise<User> {
    const { data } = await httpClient.get<User>('/me/profile')
    sessionStore.updateUser(data)
    return data
  },

  async updateProfile(input: UpdateProfileInput): Promise<User> {
    const { data } = await httpClient.patch<User>('/me/profile', input)
    sessionStore.updateUser(data)
    return data
  },

  async updateAvatar(dataUrl: string | null): Promise<User> {
    const { data } = await httpClient.put<User>('/me/avatar', { dataUrl })
    sessionStore.updateUser(data)
    return data
  },

  async changePassword(input: ChangePasswordInput): Promise<void> {
    await httpClient.post('/me/password', input)
  },

  // Catalog
  async listNfts(query: NftListQuery = {}): Promise<Paginated<Nft>> {
    const params: Record<string, string | number> = {}
    if (query.q) params.q = query.q
    if (query.category?.length) params.category = query.category.join(',')
    if (query.network?.length) params.network = query.network.join(',')
    if (query.availability && query.availability !== 'all') params.availability = query.availability
    if (query.minPrice) params.minPrice = query.minPrice
    if (query.maxPrice) params.maxPrice = query.maxPrice
    if (query.sort) params.sort = query.sort
    if (query.page) params.page = query.page
    if (query.pageSize) params.pageSize = query.pageSize
    const { data } = await httpClient.get<Paginated<Nft>>('/nfts', { params })
    return data
  },

  async getFeaturedNfts(): Promise<Nft[]> {
    const { data } = await httpClient.get<Nft[]>('/nfts/featured')
    return data
  },

  async getNft(id: string): Promise<Nft> {
    const { data } = await httpClient.get<Nft>(`/nfts/${encodeURIComponent(id)}`)
    return data
  },

  // Favorites
  async getFavorites(): Promise<FavoritesResponse> {
    const { data } = await httpClient.get<FavoritesResponse>('/me/favorites')
    return data
  },

  async addFavorite(nftId: string): Promise<FavoritesResponse> {
    const { data } = await httpClient.put<FavoritesResponse>(`/me/favorites/${encodeURIComponent(nftId)}`)
    return data
  },

  async removeFavorite(nftId: string): Promise<FavoritesResponse> {
    const { data } = await httpClient.delete<FavoritesResponse>(`/me/favorites/${encodeURIComponent(nftId)}`)
    return data
  },

  // Cart
  async getCart(): Promise<Cart> {
    const { data } = await httpClient.get<Cart>('/cart')
    return data
  },

  async addCartItem(input: CartItemInput): Promise<Cart> {
    const { data } = await httpClient.post<Cart>('/cart/items', input)
    return data
  },

  async updateCartItem(nftId: string, editionId: string, quantity: number): Promise<Cart> {
    const { data } = await httpClient.patch<Cart>(
      `/cart/items/${encodeURIComponent(nftId)}/${encodeURIComponent(editionId)}`,
      { quantity },
    )
    return data
  },

  async removeCartItem(nftId: string, editionId: string): Promise<Cart> {
    const { data } = await httpClient.delete<Cart>(
      `/cart/items/${encodeURIComponent(nftId)}/${encodeURIComponent(editionId)}`,
    )
    return data
  },

  async acknowledgeCartIssues(): Promise<Cart> {
    const { data } = await httpClient.post<Cart>('/cart/acknowledge')
    return data
  },

  async applyCoupon(code: string): Promise<Cart> {
    const { data } = await httpClient.put<Cart>('/cart/coupon', { code })
    return data
  },

  async removeCoupon(): Promise<Cart> {
    const { data } = await httpClient.delete<Cart>('/cart/coupon')
    return data
  },

  // Checkout & Orders
  async createQuote(input: QuoteRequest): Promise<Quote> {
    const { data } = await httpClient.post<Quote>('/checkout/quote', input)
    return data
  },

  async createOrder(input: CreateOrderInput, idempotencyKey: string): Promise<Order> {
    const { data } = await httpClient.post<Order>('/orders', input, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    })
    return data
  },

  async getOrder(id: string): Promise<Order> {
    const { data } = await httpClient.get<Order>(`/orders/${encodeURIComponent(id)}`)
    return data
  },

  async listOrders(): Promise<Order[]> {
    const { data } = await httpClient.get<Order[]>('/orders')
    return data
  },

  // Wallets
  async listWallets(): Promise<Wallet[]> {
    const { data } = await httpClient.get<Wallet[]>('/me/wallets')
    return data
  },

  async createWallet(input: WalletInput): Promise<Wallet> {
    const { data } = await httpClient.post<Wallet>('/me/wallets', input)
    return data
  },

  async updateWallet(id: string, input: Partial<WalletInput>): Promise<Wallet> {
    const { data } = await httpClient.patch<Wallet>(`/me/wallets/${encodeURIComponent(id)}`, input)
    return data
  },

  async connectWallet(id: string, network: Network): Promise<WalletConnection> {
    const { data } = await httpClient.post<WalletConnection>(`/me/wallets/${encodeURIComponent(id)}/connect`, {
      network,
    })
    sessionStore.setWalletConnection(data)
    return data
  },

  async disconnectWallet(id: string): Promise<void> {
    await httpClient.delete(`/me/wallets/${encodeURIComponent(id)}/connect`)
    sessionStore.setWalletConnection(null)
  },
}

