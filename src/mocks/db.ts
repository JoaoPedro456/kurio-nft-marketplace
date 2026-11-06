/**
 * "Banco" em memória da API simulada, persistido em localStorage para
 * sustentar refresh. `resetDb()` restaura integralmente o cenário semente.
 */
import type {
  AppliedCoupon,
  BuyerInfo,
  Network,
  Nft,
  Order,
  OrderStatus,
  Quote,
  User,
  Wallet,
} from '@/lib/api/contracts'
import { buildNfts, SEED_USERS } from './fixtures'

export interface UserRecord extends User {
  passwordHash: string
  salt: string
}

export interface SessionRecord {
  token: string
  userId: string
  expiresAt: string
  revoked: boolean
}

export interface CartLineRecord {
  nftId: string
  editionId: string
  quantity: number
  /** Último preço "visto/aceito" pelo usuário — usado para sinalizar alteração */
  acknowledgedPrice: string
}

export interface CartRecord {
  id: string
  ownerId: string | null
  lines: CartLineRecord[]
  couponCode: string | null
  updatedAt: string
}

export interface WalletRecord extends Wallet {
  userId: string
}

export interface ConnectionRecord {
  connectionId: string
  walletId: string
  userId: string
  network: Network
  connectedAt: string
  active: boolean
}

export interface QuoteRecord extends Quote {
  userId: string
  cartId: string
}

export interface OrderRecord extends Order {
  quoteId: string
  idempotencyKey: string
  requestHash: string
  /** Momento em que a "rede" resolve o pagamento; null = aguardando resolução manual */
  resolveAt: number | null
  outcome: Exclude<OrderStatus, 'pending'>
  /** Primeira resposta deve simular timeout (cenário order-timeout) */
  timeoutPending: boolean
}

export interface DbState {
  schema: 2
  nfts: Nft[]
  users: UserRecord[]
  sessions: SessionRecord[]
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  userCarts: Record<string, string>
  wallets: WalletRecord[]
  connections: ConnectionRecord[]
  quotes: Record<string, QuoteRecord>
  orders: OrderRecord[]
  seq: number
}

const KEY = 'nft.mock.db'

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function seed(): Promise<DbState> {
  const users: UserRecord[] = []
  for (const u of SEED_USERS) {
    const salt = `salt-${u.id}`
    users.push({
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email,
      bio: u.bio,
      avatarUrl: null,
      createdAt: '2026-01-01T12:00:00.000Z',
      salt,
      passwordHash: await hashPassword(u.password, salt),
    })
  }
  const now = '2026-01-02T12:00:00.000Z'
  return {
    schema: 2,
    nfts: buildNfts(),
    users,
    sessions: [],
    favorites: { u1: ['nft-2', 'nft-5'], u2: ['nft-9'] },
    carts: {},
    userCarts: {},
    wallets: [
      {
        id: 'w-u1-1',
        userId: 'u1',
        kind: 'primary',
        label: 'MetaMask principal',
        provider: 'metamask',
        address: '0x1111111111111111111111111111111111111111',
        networks: ['ethereum', 'polygon', 'arbitrum'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'w-u1-2',
        userId: 'u1',
        kind: 'secondary',
        label: 'Coinbase reserva',
        provider: 'coinbase',
        address: '0x2222222222222222222222222222222222222222',
        networks: ['ethereum'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'w-u2-1',
        userId: 'u2',
        kind: 'primary',
        label: 'Carteira do Bruno',
        provider: 'walletconnect',
        address: '0x3333333333333333333333333333333333333333',
        networks: ['ethereum', 'polygon'],
        createdAt: now,
        updatedAt: now,
      },
    ],
    connections: [],
    quotes: {},
    orders: [],
    seq: 1000,
  }
}

let state: DbState | null = null

export async function initDb(): Promise<void> {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schema === 2) {
        state = parsed
        return
      }
    }
  } catch {
    /* corrompido: recria */
  }
  state = await seed()
  persist()
}

export async function resetDb(): Promise<void> {
  state = await seed()
  persist()
}

export function db(): DbState {
  if (!state) throw new Error('Mock DB não inicializado')
  return state
}

export function persist() {
  if (state) localStorage.setItem(KEY, JSON.stringify(state))
}

export function nextId(prefix: string): string {
  const s = db()
  s.seq += 1
  return `${prefix}-${s.seq.toString(36)}`
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function toPublicUser(u: UserRecord): User {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt,
  }
}

export function toPublicOrder(o: OrderRecord): Order {
  return {
    id: o.id,
    userId: o.userId,
    status: o.status,
    version: o.version,
    lines: o.lines,
    coupon: o.coupon,
    subtotal: o.subtotal,
    discount: o.discount,
    networkFee: o.networkFee,
    total: o.total,
    network: o.network,
    wallet: o.wallet,
    buyer: o.buyer,
    txHash: o.txHash,
    explorerUrl: o.explorerUrl,
    declineReason: o.declineReason,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }
}

export type { AppliedCoupon, BuyerInfo }
