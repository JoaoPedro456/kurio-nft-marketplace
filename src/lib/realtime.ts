import { useSyncExternalStore } from 'react'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'
import type {
  Nft,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
  Paginated,
  RealtimeEvent,
} from '@/lib/api/contracts'
import { queryClient, queryKeys } from '@/lib/query'
import { sessionStore } from '@/lib/session'

export const SOCKET_URL =
  (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? 'wss://realtime.nft.test'

interface RealtimeBridge {
  onDirectEvent(cb: (event: RealtimeEvent, targetUserId?: string) => void): () => void
  onDrop(cb: () => void): () => void
  isAccepting(): boolean
}

function getBridge(): RealtimeBridge | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { __realtimeBridge?: RealtimeBridge }).__realtimeBridge
}

export type RealtimeConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

export interface RealtimeState {
  status: RealtimeConnectionStatus
  receivedCount: number
  ignoredDuplicatesCount: number
  ignoredStaleCount: number
  lastEvent: RealtimeEvent | null
}

let state: RealtimeState = {
  status:
    typeof window !== 'undefined' && window.location.search.includes('realtime-unavailable')
      ? 'reconnecting'
      : 'connected',
  receivedCount: 0,
  ignoredDuplicatesCount: 0,
  ignoredStaleCount: 0,
  lastEvent: null,
}

const listeners = new Set<() => void>()
function notify() {
  for (const l of listeners) l()
}

function setState(patch: Partial<RealtimeState>) {
  state = { ...state, ...patch }
  notify()
}

const seenEventIds = new Set<string>()
const resourceVersions = new Map<string, number>()

export function seedResourceVersion(type: 'nft' | 'order', id: string, version: number) {
  const key = `${type}:${id}`
  const prev = resourceVersions.get(key) ?? 0
  if (version > prev) {
    resourceVersions.set(key, version)
  }
}

export function resetRealtimeDedupeState() {
  seenEventIds.clear()
  resourceVersions.clear()
  setState({
    receivedCount: 0,
    ignoredDuplicatesCount: 0,
    ignoredStaleCount: 0,
    lastEvent: null,
  })
}

let socket: Socket | null = null
let hadConnectedOnce = false
let wasDisconnected = false
let manualDropActive = false
let manualDropTimer: ReturnType<typeof setTimeout> | null = null
let lastConnectedToken: string | null = null

function shouldAcceptEvent(evt: RealtimeEvent): boolean {
  if (!evt?.id || !evt?.resource?.id) return false
  if (seenEventIds.has(evt.id)) {
    setState({ ignoredDuplicatesCount: state.ignoredDuplicatesCount + 1 })
    return false
  }
  const rKey = `${evt.resource.type}:${evt.resource.id}`
  const knownVersion = resourceVersions.get(rKey) ?? 0
  if (evt.version <= knownVersion) {
    seenEventIds.add(evt.id)
    setState({ ignoredStaleCount: state.ignoredStaleCount + 1 })
    return false
  }
  seenEventIds.add(evt.id)
  resourceVersions.set(rKey, evt.version)
  setState({
    receivedCount: state.receivedCount + 1,
    lastEvent: evt,
  })
  return true
}

function handleNftUpdated(evt: NftUpdatedEvent) {
  if (!shouldAcceptEvent(evt)) return
  const updated = evt.data.nft

  queryClient.setQueryData<Nft>(queryKeys.nfts.detail(updated.id), (old) => {
    if (old && old.version > updated.version) return old
    return updated
  })

  queryClient.setQueriesData<Paginated<Nft>>({ queryKey: ['nfts', 'list'] }, (old) => {
    if (!old) return old
    return {
      ...old,
      items: old.items.map((item) =>
        item.id === updated.id && item.version <= updated.version ? updated : item,
      ),
    }
  })

  queryClient.invalidateQueries({ queryKey: ['cart'] })
  queryClient.invalidateQueries({ queryKey: ['quote'] })

  const soldOutNow = updated.totalAvailable === 0
  const priceChanged = evt.data.previous.floorPrice !== updated.floorPrice
  if (soldOutNow) {
    toast.warning(`${updated.name} acabou de esgotar.`, {
      id: `nft-soldout-${updated.id}-${updated.version}`,
    })
  } else if (priceChanged) {
    toast.info(`Preço atualizado: ${updated.name} agora está em ${updated.floorPrice} ETH.`, {
      id: `nft-price-${updated.id}-${updated.version}`,
    })
  }
}

function handleOrderUpdated(evt: OrderUpdatedEvent) {
  if (!shouldAcceptEvent(evt)) return
  const order = evt.data.order
  const userId = sessionStore.getUser()?.id ?? evt.userId ?? null

  queryClient.setQueryData<Order>(queryKeys.orders.detail(userId, order.id), (old) => {
    if (old && old.version > order.version) return old
    return order
  })

  queryClient.invalidateQueries({ queryKey: queryKeys.orders.all(userId) })
  queryClient.invalidateQueries({ queryKey: ['cart'] })

  if (order.status === 'confirmed') {
    toast.success(`Pedido ${order.id} confirmado na blockchain!`, {
      id: `order-confirmed-${order.id}`,
    })
  } else if (order.status === 'declined') {
    toast.error(order.declineReason ?? `Pagamento do pedido ${order.id} recusado.`, {
      id: `order-declined-${order.id}`,
    })
  }
}

export async function initRealtimeClient(): Promise<Socket> {
  if (socket) return socket

  const { io } = await import('socket.io-client')
  if (socket) return socket

  const token = sessionStore.getToken()
  lastConnectedToken = token

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    query: token ? { token } : {},
    reconnection: true,
    reconnectionDelay: 250,
    reconnectionDelayMax: 1200,
  })

  const markConnectedAndReconcile = () => {
    const reconcileNeeded = hadConnectedOnce && wasDisconnected
    hadConnectedOnce = true
    wasDisconnected = false
    setState({ status: 'connected' })

    if (reconcileNeeded) {
      queryClient.invalidateQueries({ queryKey: ['nfts'] })
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['quote'] })
    }
  }

  socket.on('connect', () => {
    if (manualDropActive) return
    markConnectedAndReconcile()
  })

  socket.on('disconnect', () => {
    wasDisconnected = true
    setState({ status: 'reconnecting' })
  })

  socket.on('connect_error', () => {
    const bridge = getBridge()
    if (manualDropActive || (bridge && !bridge.isAccepting())) {
      wasDisconnected = true
      setState({ status: 'reconnecting' })
    } else if (state.status !== 'connected') {
      markConnectedAndReconcile()
    }
  })

  socket.on('nft.updated', (evt: NftUpdatedEvent) => {
    handleNftUpdated(evt)
  })

  socket.on('order.updated', (evt: OrderUpdatedEvent) => {
    handleOrderUpdated(evt)
  })

  const bridge = getBridge()
  bridge?.onDirectEvent((evt, targetUserId) => {
    if (manualDropActive) return
    if (targetUserId) {
      const currentUserId = sessionStore.getUser()?.id
      if (currentUserId !== targetUserId) return
    }
    if (evt.type === 'nft.updated') {
      handleNftUpdated(evt)
    } else if (evt.type === 'order.updated') {
      handleOrderUpdated(evt)
    }
  })

  bridge?.onDrop(() => {
    manualDropActive = true
    wasDisconnected = true
    setState({ status: 'reconnecting' })
    if (manualDropTimer) clearTimeout(manualDropTimer)
    manualDropTimer = setTimeout(() => {
      manualDropActive = false
      if (getBridge()?.isAccepting() ?? true) {
        markConnectedAndReconcile()
      }
    }, 4000)
  })

  if (bridge?.isAccepting() ?? true) {
    setTimeout(() => {
      if (!manualDropActive && (getBridge()?.isAccepting() ?? true) && state.status !== 'connected') {
        markConnectedAndReconcile()
      }
    }, 80)
  }

  sessionStore.subscribe(() => {
    const nextToken = sessionStore.getToken()
    if (nextToken !== lastConnectedToken && socket) {
      lastConnectedToken = nextToken
      socket.io.opts.query = nextToken ? { token: nextToken } : {}
      if (socket.connected) {
        socket.disconnect().connect()
      } else {
        socket.connect()
      }
    }
  })

  return socket
}

export function reconnectRealtimeNow() {
  manualDropActive = false
  if (manualDropTimer) {
    clearTimeout(manualDropTimer)
    manualDropTimer = null
  }
  if (!socket) {
    void initRealtimeClient()
    return
  }
  const nextToken = sessionStore.getToken()
  lastConnectedToken = nextToken
  socket.io.opts.query = nextToken ? { token: nextToken } : {}
  if (getBridge()?.isAccepting() ?? true) {
    wasDisconnected = true
    hadConnectedOnce = true
    setState({ status: 'connected' })
    queryClient.invalidateQueries({ queryKey: ['nfts'] })
    queryClient.invalidateQueries({ queryKey: ['cart'] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['quote'] })
  }
  if (socket.connected) {
    socket.disconnect().connect()
  } else {
    socket.connect()
  }
}

export function useRealtimeState(): RealtimeState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
    () => state,
  )
}

