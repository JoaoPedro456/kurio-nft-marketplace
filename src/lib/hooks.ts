import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, AppApiError } from '@/lib/api/client'
import type {
  CartItemInput,
  FavoritesResponse,
  Network,
  NftListQuery,
  WalletInput,
} from '@/lib/api/contracts'
import { queryKeys } from '@/lib/query'
import { seedResourceVersion } from '@/lib/realtime'
import { useAuthSnapshot } from '@/lib/session'
import { buildNfts } from '@/mocks/fixtures'

const INITIAL_CATALOG = buildNfts()
const INITIAL_LOADED_AT = Date.now()

function canUseCleanInitialSeed(): boolean {
  if (typeof window === 'undefined') return false
  if (window.location.search.includes('catalog-error')) return false
  if (localStorage.getItem('nft.mock.db')) return false
  return true
}

export function useCartScopeId(): string {
  const { session, guestCartId } = useAuthSnapshot()
  return session?.user.id ? `user:${session.user.id}` : `guest:${guestCartId}`
}

export function useNftsQuery(params: NftListQuery) {
  const isDefault =
    !params.q &&
    !params.category?.length &&
    !params.network?.length &&
    (!params.availability || params.availability === 'all') &&
    !params.minPrice &&
    !params.maxPrice &&
    (!params.sort || params.sort === 'recent') &&
    (!params.page || params.page === 1)
  const useSeed = isDefault && canUseCleanInitialSeed()
  const pageSize = params.pageSize ?? 9

  return useQuery({
    queryKey: queryKeys.nfts.list(params),
    queryFn: async () => {
      const res = await api.listNfts(params)
      for (const item of res.items) {
        seedResourceVersion('nft', item.id, item.version)
      }
      return res
    },
    initialData: useSeed
      ? {
          items: INITIAL_CATALOG.slice(0, pageSize),
          total: INITIAL_CATALOG.length,
          page: 1,
          pageSize,
          totalPages: Math.ceil(INITIAL_CATALOG.length / pageSize),
        }
      : undefined,
    initialDataUpdatedAt: useSeed ? INITIAL_LOADED_AT : undefined,
    staleTime: useSeed ? 15_000 : 0,
  })
}

export function useFeaturedNftsQuery() {
  const useSeed = canUseCleanInitialSeed()
  return useQuery({
    queryKey: queryKeys.nfts.featured(),
    queryFn: async () => {
      const items = await api.getFeaturedNfts()
      for (const item of items) {
        seedResourceVersion('nft', item.id, item.version)
      }
      return items
    },
    initialData: useSeed ? INITIAL_CATALOG.slice(0, 4) : undefined,
    initialDataUpdatedAt: useSeed ? INITIAL_LOADED_AT : undefined,
    staleTime: useSeed ? 15_000 : 0,
  })
}

export function useNftDetailQuery(nftId: string) {
  const seededNft = canUseCleanInitialSeed()
    ? INITIAL_CATALOG.find((n) => n.id === nftId || n.slug === nftId)
    : undefined

  return useQuery({
    queryKey: queryKeys.nfts.detail(nftId),
    queryFn: async () => {
      const nft = await api.getNft(nftId)
      seedResourceVersion('nft', nft.id, nft.version)
      return nft
    },
    initialData: seededNft,
    initialDataUpdatedAt: seededNft ? INITIAL_LOADED_AT : undefined,
    staleTime: seededNft ? 15_000 : 0,
    enabled: Boolean(nftId),
  })
}

export function useFavoritesQuery() {
  const { session } = useAuthSnapshot()
  const userId = session?.user.id ?? null
  return useQuery({
    queryKey: queryKeys.favorites(userId),
    queryFn: () => api.getFavorites(),
    enabled: Boolean(userId),
  })
}

export function useToggleFavoriteMutation() {
  const qc = useQueryClient()
  const { session } = useAuthSnapshot()
  const userId = session?.user.id ?? null
  const key = queryKeys.favorites(userId)

  return useMutation({
    mutationFn: async ({ nftId, isFavorite }: { nftId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        return api.removeFavorite(nftId)
      }
      return api.addFavorite(nftId)
    },
    onMutate: async ({ nftId, isFavorite }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<FavoritesResponse>(key)
      const currentIds = previous?.nftIds ?? []
      const nextIds = isFavorite
        ? currentIds.filter((id) => id !== nftId)
        : Array.from(new Set([...currentIds, nftId]))
      qc.setQueryData<FavoritesResponse>(key, { nftIds: nextIds })
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(key, context.previous)
      } else {
        qc.setQueryData<FavoritesResponse>(key, { nftIds: [] })
      }
      const message = err instanceof AppApiError ? err.message : 'Não foi possível atualizar os favoritos.'
      toast.error(message)
    },
    onSuccess: (data) => {
      qc.setQueryData<FavoritesResponse>(key, data)
    },
  })
}

export function useCartQuery() {
  const scopeId = useCartScopeId()
  const useEmptySeed =
    canUseCleanInitialSeed() &&
    typeof window !== 'undefined' &&
    !localStorage.getItem('nft.session')

  return useQuery({
    queryKey: queryKeys.cart(scopeId),
    queryFn: () => api.getCart(),
    initialData: useEmptySeed
      ? {
          id: scopeId,
          items: [],
          coupon: null,
          summary: {
            subtotal: '0',
            discount: '0',
            networkFee: '0',
            total: '0',
            itemCount: 0,
          },
          updatedAt: '2026-01-01T00:00:00.000Z',
        }
      : undefined,
    initialDataUpdatedAt: useEmptySeed ? INITIAL_LOADED_AT : undefined,
    staleTime: useEmptySeed ? 15_000 : 0,
  })
}

export function useCartMutations() {
  const qc = useQueryClient()
  const scopeId = useCartScopeId()
  const cartKey = queryKeys.cart(scopeId)

  const invalidateQuote = () => {
    qc.invalidateQueries({ queryKey: ['quote'] })
  }

  const addItem = useMutation({
    mutationFn: (input: CartItemInput) => api.addCartItem(input),
    onSuccess: (cart) => {
      qc.setQueryData(cartKey, cart)
      invalidateQuote()
    },
  })

  const updateItem = useMutation({
    mutationFn: ({ nftId, editionId, quantity }: CartItemInput) =>
      api.updateCartItem(nftId, editionId, quantity),
    onSuccess: (cart) => {
      qc.setQueryData(cartKey, cart)
      invalidateQuote()
    },
  })

  const removeItem = useMutation({
    mutationFn: ({ nftId, editionId }: { nftId: string; editionId: string }) =>
      api.removeCartItem(nftId, editionId),
    onSuccess: (cart) => {
      qc.setQueryData(cartKey, cart)
      invalidateQuote()
    },
  })

  const acknowledgeIssues = useMutation({
    mutationFn: () => api.acknowledgeCartIssues(),
    onSuccess: (cart) => {
      qc.setQueryData(cartKey, cart)
      invalidateQuote()
    },
  })

  const applyCoupon = useMutation({
    mutationFn: (code: string) => api.applyCoupon(code),
    onSuccess: (cart) => {
      qc.setQueryData(cartKey, cart)
      invalidateQuote()
    },
  })

  const removeCoupon = useMutation({
    mutationFn: () => api.removeCoupon(),
    onSuccess: (cart) => {
      qc.setQueryData(cartKey, cart)
      invalidateQuote()
    },
  })

  return {
    addItem,
    updateItem,
    removeItem,
    acknowledgeIssues,
    applyCoupon,
    removeCoupon,
  }
}

export function useQuoteQuery(network: Network, cartUpdatedAt: string, enabled = true) {
  const { session } = useAuthSnapshot()
  const userId = session?.user.id ?? null
  return useQuery({
    queryKey: queryKeys.quote(userId, network, cartUpdatedAt),
    queryFn: () => api.createQuote({ network }),
    enabled: Boolean(userId && enabled && cartUpdatedAt),
    staleTime: 5_000,
  })
}

export function useWalletsQuery() {
  const { session } = useAuthSnapshot()
  const userId = session?.user.id ?? null
  return useQuery({
    queryKey: queryKeys.wallets(userId),
    queryFn: () => api.listWallets(),
    enabled: Boolean(userId),
  })
}

export function useWalletMutations() {
  const qc = useQueryClient()
  const { session } = useAuthSnapshot()
  const userId = session?.user.id ?? null
  const key = queryKeys.wallets(userId)

  const createWallet = useMutation({
    mutationFn: (input: WalletInput) => api.createWallet(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })

  const updateWallet = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<WalletInput> }) =>
      api.updateWallet(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })

  const connectWallet = useMutation({
    mutationFn: ({ id, network }: { id: string; network: Network }) =>
      api.connectWallet(id, network),
  })

  const disconnectWallet = useMutation({
    mutationFn: (id: string) => api.disconnectWallet(id),
  })

  return { createWallet, updateWallet, connectWallet, disconnectWallet }
}

export function useOrderQuery(orderId: string) {
  const { session } = useAuthSnapshot()
  const userId = session?.user.id ?? null
  return useQuery({
    queryKey: queryKeys.orders.detail(userId, orderId),
    queryFn: async () => {
      const order = await api.getOrder(orderId)
      seedResourceVersion('order', order.id, order.version)
      return order
    },
    enabled: Boolean(userId && orderId),
    refetchInterval: (query) => {
      const data = query.state.data
      return data?.status === 'pending' ? 1200 : false
    },
  })
}

export function useOrdersListQuery(enabled = true) {
  const { session } = useAuthSnapshot()
  const userId = session?.user.id ?? null
  return useQuery({
    queryKey: queryKeys.orders.all(userId),
    queryFn: () => api.listOrders(),
    enabled: Boolean(userId && enabled),
  })
}

