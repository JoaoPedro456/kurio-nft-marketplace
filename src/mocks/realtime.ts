/**
 * Servidor Socket.IO simulado via MSW (`ws.link`) + @mswjs/socket.io-binding.
 *
 * Transporte: somente WebSocket (o cliente usa `transports: ['websocket']`).
 * O binding faz o handshake Engine.IO/Socket.IO e codifica pacotes EVENT no
 * namespace "/". Não há suporte a polling HTTP, namespaces, rooms ou acks;
 * "rooms" por usuário são implementadas aqui mantendo o userId de cada conexão
 * (derivado do token enviado em `query.token`).
 */
import { ws, type WebSocketHandlerConnection } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { RealtimeEvent } from '@/lib/api/contracts'
import { db } from './db'

export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? 'wss://realtime.nft.test'

interface LiveConnection {
  id: number
  userId: string | null
  raw: WebSocketHandlerConnection
  io: ReturnType<typeof toSocketIo>
  ping: ReturnType<typeof setInterval>
}

const connections = new Map<number, LiveConnection>()
let seq = 0
let accepting = true
/** Histórico dos últimos eventos enviados (para cenários de duplicata/antigo) */
const history: RealtimeEvent[] = []
const directListeners = new Set<(event: RealtimeEvent, targetUserId?: string) => void>()
const dropListeners = new Set<() => void>()

function userIdFromToken(token: string | null): string | null {
  if (!token) return null
  const s = db().sessions.find((x) => x.token === token && !x.revoked && new Date(x.expiresAt).getTime() > Date.now())
  return s?.userId ?? null
}

function deliver(conn: LiveConnection, event: RealtimeEvent) {
  conn.io.client.emit(event.type, event)
}

function notifyDirectIfNoWs(event: RealtimeEvent, targetUserId?: string) {
  if (!accepting || connections.size > 0) return
  directListeners.forEach((cb) => cb(event, targetUserId))
}

function remember(event: RealtimeEvent) {
  history.push(event)
  if (history.length > 50) history.shift()
}

export const realtime = {
  onDirectEvent(cb: (event: RealtimeEvent, targetUserId?: string) => void) {
    directListeners.add(cb)
    return () => directListeners.delete(cb)
  },
  onDrop(cb: () => void) {
    dropListeners.add(cb)
    return () => dropListeners.delete(cb)
  },
  /** Evento público (ex.: nft.updated) para todos os conectados */
  broadcast(event: RealtimeEvent) {
    remember(event)
    connections.forEach((c) => deliver(c, event))
    notifyDirectIfNoWs(event)
  },
  /** Evento privado somente para conexões do usuário dono */
  sendToUser(userId: string, event: RealtimeEvent) {
    remember(event)
    connections.forEach((c) => {
      if (c.userId === userId) deliver(c, event)
    })
    notifyDirectIfNoWs(event, userId)
  },
  /** Reenvia um evento já emitido (duplicata ou evento antigo fora de ordem) */
  replay(
    indexOrOpts:
      | number
      | { duplicateLast?: boolean; staleVersion?: boolean } = -1,
  ) {
    if (typeof indexOrOpts === 'number') {
      const event = history.at(indexOrOpts)
      if (!event) return null
      connections.forEach((c) => {
        if (event.type === 'nft.updated' || c.userId === event.userId) deliver(c, event)
      })
      notifyDirectIfNoWs(event, event.type === 'order.updated' ? event.userId : undefined)
      return event
    }
    const last = history.at(-1)
    if (!last) return null
    if (indexOrOpts.duplicateLast) {
      connections.forEach((c) => {
        if (last.type === 'nft.updated' || c.userId === last.userId) deliver(c, last)
      })
      notifyDirectIfNoWs(last, last.type === 'order.updated' ? last.userId : undefined)
    }
    if (indexOrOpts.staleVersion) {
      const staleEvt: RealtimeEvent = {
        ...last,
        id: `evt-stale-${crypto.randomUUID()}`,
        version: Math.max(1, last.version - 1),
      }
      connections.forEach((c) => {
        if (staleEvt.type === 'nft.updated' || c.userId === staleEvt.userId) deliver(c, staleEvt)
      })
      notifyDirectIfNoWs(staleEvt, staleEvt.type === 'order.updated' ? staleEvt.userId : undefined)
    }
    return last
  },
  clearHistory() {
    history.length = 0
  },
  history() {
    return [...history]
  },
  /** Derruba todas as conexões; o socket.io-client reconecta sozinho */
  dropAll() {
    connections.forEach((c) => {
      clearInterval(c.ping)
      c.raw.client.close()
    })
    connections.clear()
    dropListeners.forEach((cb) => cb())
  },
  /** Simula indisponibilidade do servidor de tempo real */
  setAccepting(value: boolean) {
    accepting = value
    if (!value) realtime.dropAll()
  },
  isAccepting() {
    return accepting
  },
  count() {
    return connections.size
  },
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { __realtimeBridge?: typeof realtime }).__realtimeBridge = realtime
}

const link = ws.link(/\/socket\.io\//)

export const realtimeHandlers = [
  link.addEventListener('connection', (connection) => {
    if (!accepting) {
      connection.client.close(1011, 'unavailable')
      return
    }
    const url = new URL(connection.client.url)
    const id = ++seq
    const io = toSocketIo(connection)
    const conn: LiveConnection = {
      id,
      userId: userIdFromToken(url.searchParams.get('token')),
      raw: connection,
      io,
      // Heartbeat Engine.IO: o cliente desconecta se não receber ping a cada pingInterval+pingTimeout
      ping: setInterval(() => connection.client.send('2'), 20_000),
    }
    connections.set(id, conn)
    connection.client.addEventListener('close', () => {
      clearInterval(conn.ping)
      connections.delete(id)
    })
  }),
]
