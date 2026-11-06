import { initRealtimeClient } from '@/lib/realtime'

let startPromise: Promise<void> | null = null
const pendingMockCalls: Array<(api: typeof window.__mock) => void> = []

export function queueMockCall(fn: (api: typeof window.__mock) => void) {
  pendingMockCalls.push(fn)
  void ensureMocksStarted()
}

export function ensureMocksStarted(): Promise<void> {
  if (!startPromise) {
    startPromise = import('@/mocks/browser').then(async ({ startMocks }) => {
      await startMocks()
      await initRealtimeClient()
      while (pendingMockCalls.length > 0) {
        const fn = pendingMockCalls.shift()
        fn?.(window.__mock)
      }
    })
  }
  return startPromise
}

