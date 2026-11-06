/**
 * Regras de negócio da API simulada: carrinho, cotação, pedidos e
 * alterações de catálogo. Toda mudança relevante gera eventos Socket.IO.
 */
import type {
  AppliedCoupon,
  Cart,
  CartItem,
  CartItemIssue,
  Network,
  Nft,
  NftEdition,
  NftUpdatedEvent,
  OrderUpdatedEvent,
  Quote,
  QuoteLine,
} from '@/lib/api/contracts'
import { add, cmp, mul, percentOf, sub } from '@/lib/money'
import { COUPONS, recomputeDerived } from './fixtures'
import { db, nextId, persist, toPublicOrder, type CartRecord, type OrderRecord, type QuoteRecord } from './db'
import { realtime } from './realtime'

// ---------------- Taxas de rede ----------------
const NETWORK_FEES: Record<Network, { base: string; perLine: string }> = {
  ethereum: { base: '0.0042', perLine: '0.0008' },
  polygon: { base: '0.0004', perLine: '0.0001' },
  arbitrum: { base: '0.0011', perLine: '0.0002' },
}

export function networkFee(network: Network, lines: number): string {
  if (lines === 0) return '0'
  const f = NETWORK_FEES[network]
  return add(f.base, mul(f.perLine, lines))
}

// ---------------- Cupons ----------------
export type CouponCheck = { ok: true; coupon: AppliedCoupon } | { ok: false; code: 'COUPON_INVALID' | 'COUPON_EXPIRED' }

export function checkCoupon(code: string): CouponCheck {
  const c = COUPONS.find((x) => x.code === code.trim().toUpperCase())
  if (!c) return { ok: false, code: 'COUPON_INVALID' }
  if (new Date(c.expiresAt).getTime() < Date.now()) return { ok: false, code: 'COUPON_EXPIRED' }
  return { ok: true, coupon: { code: c.code, description: c.description, percentOff: c.percentOff } }
}

// ---------------- Catálogo ----------------
export function findNft(id: string): Nft | undefined {
  return db().nfts.find((n) => n.id === id || n.slug === id)
}

export function findEdition(nft: Nft, editionId: string): NftEdition | undefined {
  return nft.editions.find((e) => e.id === editionId)
}

function makeEventId() {
  return `evt-${crypto.randomUUID()}`
}

/** Aplica alteração em um NFT, incrementa versão, persiste e emite `nft.updated`. */
export function updateNft(id: string, mutate: (editions: NftEdition[]) => void): Nft | undefined {
  const s = db()
  const idx = s.nfts.findIndex((n) => n.id === id)
  if (idx < 0) return
  const prev = s.nfts[idx]
  const editions = prev.editions.map((e) => ({ ...e }))
  mutate(editions)
  const next = recomputeDerived({ ...prev, editions, version: prev.version + 1 })
  s.nfts[idx] = next
  persist()
  const event: NftUpdatedEvent = {
    id: makeEventId(),
    type: 'nft.updated',
    resource: { type: 'nft', id: next.id },
    version: next.version,
    occurredAt: new Date().toISOString(),
    data: {
      nft: next,
      previous: {
        floorPrice: prev.floorPrice,
        editions: prev.editions.map(({ id, price, available, enabled }) => ({ id, price, available, enabled })),
      },
    },
  }
  realtime.broadcast(event)
  return next
}

/** Simula alteração de preço em tempo real de um NFT/edição. */
export function simulatePriceChange(
  nftId: string,
  editionId?: string,
  newPrice?: string,
): Nft | undefined {
  return updateNft(nftId, (editions) => {
    const target = editionId ? editions.find((e) => e.id === editionId) : editions[0]
    if (!target) return
    target.price = newPrice ?? mul(target.price, '1.15')
  })
}

/** Simula esgotamento de estoque em tempo real de um NFT/edição. */
export function simulateSoldOut(nftId: string, editionId?: string): Nft | undefined {
  return updateNft(nftId, (editions) => {
    if (editionId) {
      const target = editions.find((e) => e.id === editionId)
      if (target) target.available = 0
    } else {
      for (const e of editions) e.available = 0
    }
  })
}

// ---------------- Carrinho ----------------
export function getOrCreateCart(userId: string | null, guestCartId: string | null): CartRecord {
  const s = db()
  if (userId) {
    const id = s.userCarts[userId]
    if (id && s.carts[id]) return s.carts[id]
    const cart: CartRecord = { id: nextId('cart'), ownerId: userId, lines: [], couponCode: null, updatedAt: new Date().toISOString() }
    s.carts[cart.id] = cart
    s.userCarts[userId] = cart.id
    persist()
    return cart
  }
  if (guestCartId && s.carts[guestCartId] && s.carts[guestCartId].ownerId === null) return s.carts[guestCartId]
  const id = guestCartId && !s.carts[guestCartId] ? guestCartId : nextId('guest')
  const cart: CartRecord = { id, ownerId: null, lines: [], couponCode: null, updatedAt: new Date().toISOString() }
  s.carts[cart.id] = cart
  persist()
  return cart
}

const BLOCKING: CartItemIssue[] = ['SOLD_OUT', 'EDITION_UNAVAILABLE', 'INSUFFICIENT_STOCK']

export function lineIssues(edition: NftEdition, quantity: number, acknowledgedPrice: string): CartItemIssue[] {
  const issues: CartItemIssue[] = []
  if (!edition.enabled) issues.push('EDITION_UNAVAILABLE')
  else if (edition.available === 0) issues.push('SOLD_OUT')
  else if (quantity > edition.available) issues.push('INSUFFICIENT_STOCK')
  if (cmp(edition.price, acknowledgedPrice) !== 0) issues.push('PRICE_CHANGED')
  return issues
}

export function cartCoupon(cart: CartRecord): AppliedCoupon | null {
  if (!cart.couponCode) return null
  const r = checkCoupon(cart.couponCode)
  return r.ok ? r.coupon : null
}

export function toPublicCart(cart: CartRecord): Cart {
  const items: CartItem[] = []
  for (const line of cart.lines) {
    const nft = findNft(line.nftId)
    const ed = nft && findEdition(nft, line.editionId)
    if (!nft || !ed) continue
    const issues = lineIssues(ed, line.quantity, line.acknowledgedPrice)
    items.push({
      nftId: nft.id,
      editionId: ed.id,
      name: nft.name,
      editionName: ed.name,
      image: nft.images[0],
      creatorName: nft.creator.name,
      quantity: line.quantity,
      unitPrice: ed.price,
      previousUnitPrice: issues.includes('PRICE_CHANGED') ? line.acknowledgedPrice : null,
      available: ed.enabled ? ed.available : 0,
      maxPerOrder: ed.maxPerOrder,
      lineTotal: mul(ed.price, line.quantity),
      issues,
      nftVersion: nft.version,
    })
  }
  const purchasable = items.filter((i) => !i.issues.some((x) => x === 'SOLD_OUT' || x === 'EDITION_UNAVAILABLE'))
  const subtotal = add('0', ...purchasable.map((i) => i.lineTotal))
  const coupon = cartCoupon(cart)
  const discount = coupon ? percentOf(subtotal, coupon.percentOff) : '0'
  const fee = networkFee('ethereum', purchasable.length)
  return {
    id: cart.id,
    items,
    coupon,
    summary: {
      subtotal,
      discount,
      networkFee: fee,
      total: add(sub(subtotal, discount), fee),
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
    },
    updatedAt: cart.updatedAt,
  }
}

// ---------------- Cotação ----------------
export function buildQuote(cart: CartRecord, userId: string, network: Network): QuoteRecord {
  const lines: QuoteLine[] = []
  const issues: Quote['issues'] = []
  for (const line of cart.lines) {
    const nft = findNft(line.nftId)
    const ed = nft && findEdition(nft, line.editionId)
    if (!nft || !ed) continue
    for (const issue of lineIssues(ed, line.quantity, ed.price)) {
      if (BLOCKING.includes(issue)) issues.push({ nftId: nft.id, editionId: ed.id, issue })
    }
    lines.push({
      nftId: nft.id,
      editionId: ed.id,
      name: nft.name,
      editionName: ed.name,
      image: nft.images[0],
      quantity: line.quantity,
      unitPrice: ed.price,
      lineTotal: mul(ed.price, line.quantity),
    })
  }
  const subtotal = add('0', ...lines.map((l) => l.lineTotal))
  const coupon = cartCoupon(cart)
  const discount = coupon ? percentOf(subtotal, coupon.percentOff) : '0'
  const fee = networkFee(network, lines.length)
  const now = Date.now()
  return {
    id: nextId('quote'),
    userId,
    cartId: cart.id,
    network,
    lines,
    coupon,
    subtotal,
    discount,
    networkFee: fee,
    total: add(sub(subtotal, discount), fee),
    issues,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 10 * 60_000).toISOString(),
  }
}

export function publicQuote(q: QuoteRecord): Quote {
  const { userId: _u, cartId: _c, ...rest } = q
  return rest
}

/** Lista legível das diferenças entre duas cotações. */
export function diffQuotes(prev: Quote, curr: Quote): string[] {
  const changes: string[] = []
  for (const p of prev.lines) {
    const c = curr.lines.find((l) => l.nftId === p.nftId && l.editionId === p.editionId)
    if (!c) changes.push(`${p.name} (${p.editionName}) não está mais no carrinho`)
    else {
      if (cmp(p.unitPrice, c.unitPrice) !== 0) changes.push(`Preço de ${p.name} (${p.editionName}) mudou de ${p.unitPrice} para ${c.unitPrice} ETH`)
      if (p.quantity !== c.quantity) changes.push(`Quantidade de ${p.name} mudou de ${p.quantity} para ${c.quantity}`)
    }
  }
  for (const c of curr.lines) {
    if (!prev.lines.find((l) => l.nftId === c.nftId && l.editionId === c.editionId)) changes.push(`${c.name} (${c.editionName}) foi adicionado`)
  }
  for (const i of curr.issues) {
    const l = curr.lines.find((x) => x.nftId === i.nftId && x.editionId === i.editionId)
    const label = l ? `${l.name} (${l.editionName})` : i.nftId
    changes.push(i.issue === 'INSUFFICIENT_STOCK' ? `${label}: estoque insuficiente` : `${label}: indisponível`)
  }
  if ((prev.coupon?.code ?? null) !== (curr.coupon?.code ?? null)) {
    changes.push(curr.coupon ? `Cupom ${curr.coupon.code} aplicado` : `Cupom ${prev.coupon?.code} não é mais válido`)
  }
  if (cmp(prev.networkFee, curr.networkFee) !== 0) changes.push(`Taxa de rede mudou de ${prev.networkFee} para ${curr.networkFee} ETH`)
  if (changes.length === 0 && cmp(prev.total, curr.total) !== 0) changes.push(`Total mudou de ${prev.total} para ${curr.total} ETH`)
  return changes
}

export function quotesEquivalent(a: Quote, b: Quote): boolean {
  return b.issues.length === 0 && diffQuotes(a, b).length === 0 && cmp(a.total, b.total) === 0
}

// ---------------- Pedidos ----------------
function emitOrder(order: OrderRecord) {
  const event: OrderUpdatedEvent = {
    id: makeEventId(),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    userId: order.userId,
    data: { order: toPublicOrder(order) },
  }
  realtime.sendToUser(order.userId, event)
}

function fakeHash(seed: string) {
  let h = 0x811c9dc5
  let out = ''
  for (let round = 0; round < 8; round++) {
    for (const ch of seed + round) {
      h ^= ch.charCodeAt(0)
      h = Math.imul(h, 0x01000193)
    }
    out += (h >>> 0).toString(16).padStart(8, '0')
  }
  return `0x${out.slice(0, 64)}`
}

/** Reserva estoque ao criar o pedido. */
export function reserveStock(order: OrderRecord) {
  for (const l of order.lines) {
    updateNft(l.nftId, (eds) => {
      const e = eds.find((x) => x.id === l.editionId)
      if (e) e.available = Math.max(0, e.available - l.quantity)
    })
  }
}

function releaseStock(order: OrderRecord) {
  for (const l of order.lines) {
    updateNft(l.nftId, (eds) => {
      const e = eds.find((x) => x.id === l.editionId)
      if (e) e.available = Math.min(e.supply, e.available + l.quantity)
    })
  }
}

/** Resolve um pedido pendente (confirmado ou recusado). Estados terminais não mudam. */
export function resolveOrder(orderId: string, outcome?: 'confirmed' | 'declined') {
  const s = db()
  const order = s.orders.find((o) => o.id === orderId)
  if (!order || order.status !== 'pending') return
  const status = outcome ?? order.outcome
  order.status = status
  order.version += 1
  order.updatedAt = new Date().toISOString()
  if (status === 'confirmed') {
    order.txHash = fakeHash(order.id)
    order.explorerUrl = `https://etherscan.io/tx/${order.txHash}?simulated=1`
    // Remove do carrinho apenas os itens/quantidades comprados
    const cartId = s.userCarts[order.userId]
    const cart = cartId ? s.carts[cartId] : undefined
    if (cart) {
      for (const l of order.lines) {
        const line = cart.lines.find((x) => x.nftId === l.nftId && x.editionId === l.editionId)
        if (line) line.quantity -= l.quantity
      }
      cart.lines = cart.lines.filter((x) => x.quantity > 0)
      if (cart.lines.length === 0) cart.couponCode = null
      cart.updatedAt = new Date().toISOString()
    }
  } else {
    order.declineReason = 'Pagamento recusado pela carteira (simulado).'
    releaseStock(order)
  }
  persist()
  emitOrder(order)
}

/** Processa pedidos cuja resolução venceu. Chamado periodicamente e em leituras. */
export function tickOrders() {
  const now = Date.now()
  for (const o of db().orders) {
    if (o.status === 'pending' && o.resolveAt !== null && o.resolveAt <= now) resolveOrder(o.id)
  }
}
