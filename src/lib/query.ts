import { QueryClient } from '@tanstack/react-query'
import type { NftListQuery } from '@/lib/api/contracts'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (failureCount, error: unknown) => {
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as { status: number }).status
          if (status >= 400 && status < 500 && status !== 408) {
            return false
          }
        }
        return failureCount < 1
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})

export const queryKeys = {
  nfts: {
    all: ['nfts'] as const,
    list: (params: NftListQuery) => ['nfts', 'list', params] as const,
    featured: () => ['nfts', 'featured'] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
  },
  favorites: (userId: string | null) => ['favorites', userId ?? 'guest'] as const,
  cart: (scopeId: string) => ['cart', scopeId] as const,
  quote: (userId: string | null, network: string, cartUpdatedAt: string) =>
    ['quote', userId ?? 'guest', network, cartUpdatedAt] as const,
  wallets: (userId: string | null) => ['wallets', userId ?? 'guest'] as const,
  orders: {
    all: (userId: string | null) => ['orders', userId ?? 'guest'] as const,
    detail: (userId: string | null, orderId: string) => ['orders', userId ?? 'guest', orderId] as const,
  },
  profile: (userId: string | null) => ['profile', userId ?? 'guest'] as const,
}

export function clearUserScopedCache(qc: QueryClient = queryClient) {
  qc.removeQueries({ queryKey: ['favorites'] })
  qc.removeQueries({ queryKey: ['cart'] })
  qc.removeQueries({ queryKey: ['quote'] })
  qc.removeQueries({ queryKey: ['wallets'] })
  qc.removeQueries({ queryKey: ['orders'] })
  qc.removeQueries({ queryKey: ['profile'] })
}
