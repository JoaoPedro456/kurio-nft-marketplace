import { setupWorker } from 'msw/browser'
import {
  applyUrlOverrides,
  getConfig,
  resetConfig,
  setFlag,
  setNetwork,
  setOrderResolveMs,
  type MockConfig,
  type NetworkProfile,
  type ScenarioFlag,
} from './config'
import { db, initDb, persist, resetDb } from './db'
import { resolveOrder, simulatePriceChange, simulateSoldOut, tickOrders } from './domain'
import { authHandlers, catalogHandlers, resetCatalogCounters } from './handlers/account'
import { commerceHandlers, resetCommerceCounters } from './handlers/commerce'
import { realtime, realtimeHandlers } from './realtime'

export interface MockApi {
  reset(): Promise<void>
  getConfig(): MockConfig
  setNetwork(profile: NetworkProfile): MockConfig
  setFlag(flag: ScenarioFlag, enabled: boolean): MockConfig
  setOrderResolveMs(ms: number): MockConfig
  simulatePriceChange(nftId: string, editionId?: string, newPrice?: string): void
  simulateSoldOut(nftId: string, editionId?: string): void
  resolveOrder(orderId: string, outcome?: 'confirmed' | 'declined'): void
  expireCurrentSession(): void
  disconnectWallet(): void
  dropSocket(): void
  replayEvents(opts?: { duplicateLast?: boolean; staleVersion?: boolean }): void
}

declare global {
  interface Window {
    __mock: MockApi
  }
}

export const worker = setupWorker(
  ...realtimeHandlers,
  ...authHandlers,
  ...catalogHandlers,
  ...commerceHandlers,
)

let orderTimer: ReturnType<typeof setInterval> | null = null

export async function startMocks(): Promise<void> {
  await initDb()
  applyUrlOverrides()

  window.__mock = {
    async reset() {
      resetConfig()
      resetCatalogCounters()
      resetCommerceCounters()
      realtime.clearHistory()
      await resetDb()
    },
    getConfig,
    setNetwork,
    setFlag,
    setOrderResolveMs,
    simulatePriceChange(nftId, editionId, newPrice) {
      simulatePriceChange(nftId, editionId, newPrice)
    },
    simulateSoldOut(nftId, editionId) {
      simulateSoldOut(nftId, editionId)
    },
    resolveOrder(orderId, outcome) {
      resolveOrder(orderId, outcome)
    },
    expireCurrentSession() {
      const s = db()
      const past = new Date(Date.now() - 60_000).toISOString()
      for (const sess of s.sessions) {
        sess.expiresAt = past
      }
      persist()
    },
    disconnectWallet() {
      const s = db()
      for (const c of s.connections) {
        c.active = false
      }
      persist()
    },
    dropSocket() {
      realtime.dropAll()
    },
    replayEvents(opts) {
      realtime.replay(opts)
    },
  }

  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })

  if (!orderTimer) {
    orderTimer = setInterval(() => {
      try {
        tickOrders()
      } catch {
        /* ignore before db ready */
      }
    }, 300)
  }
}

