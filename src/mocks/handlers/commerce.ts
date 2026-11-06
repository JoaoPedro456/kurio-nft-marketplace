import { delay, http, HttpResponse } from 'msw'
import type {
  Cart,
  CartItemInput,
  CreateOrderInput,
  Network,
  Order,
  Quote,
  QuoteRequest,
  QuoteStaleDetails,
  Wallet,
  WalletConnection,
  WalletInput,
} from '@/lib/api/contracts'
import { getConfig, hasFlag } from '../config'
import { db, nextId, persist, toPublicOrder, type CartRecord, type OrderRecord, type WalletRecord } from '../db'
import {
  buildQuote,
  checkCoupon,
  diffQuotes,
  findEdition,
  findNft,
  getOrCreateCart,
  publicQuote,
  quotesEquivalent,
  reserveStock,
  tickOrders,
  toPublicCart,
  updateNft,
} from '../domain'
import { ADDRESS_RE, API, apiError, authenticate, EMAIL_RE, optionalAuth, readJson } from '../http'
import { simulateNetwork } from '../network'

const NETWORKS: Network[] = ['ethereum', 'polygon', 'arbitrum']

/** Resolve o carrinho da requisição: do usuário autenticado ou do visitante (X-Cart-Id). */
function resolveCart(request: Request): { cart: CartRecord } | { response: Response } {
  const auth = optionalAuth(request)
  if (auth && !auth.ok) return { response: auth.response }
  const cart = getOrCreateCart(auth?.ok ? auth.user.id : null, request.headers.get('x-cart-id'))
  return { cart }
}

function touch(cart: CartRecord) {
  cart.updatedAt = new Date().toISOString()
  persist()
}

function validateQuantity(input: Partial<CartItemInput>, existingQty = 0): Response | { nftId: string; editionId: string; quantity: number } {
  const nft = input.nftId ? findNft(input.nftId) : undefined
  if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
  const ed = input.editionId ? findEdition(nft, input.editionId) : undefined
  if (!ed) return apiError(404, 'NOT_FOUND', 'Edição não encontrada.')
  const qty = Number(input.quantity)
  if (!Number.isInteger(qty) || qty < 1) {
    return apiError(422, 'VALIDATION_ERROR', 'Quantidade inválida.', { fields: { quantity: 'A quantidade deve ser um número inteiro maior que zero.' } })
  }
  if (!ed.enabled) return apiError(409, 'AVAILABILITY_CONFLICT', `A edição ${ed.name} está indisponível.`)
  const total = existingQty + qty
  if (ed.available === 0) return apiError(409, 'AVAILABILITY_CONFLICT', `A edição ${ed.name} está esgotada.`)
  if (total > ed.available) return apiError(409, 'AVAILABILITY_CONFLICT', `Apenas ${ed.available} unidade(s) disponível(is) da edição ${ed.name}.`, { details: { available: ed.available } })
  if (total > ed.maxPerOrder) return apiError(409, 'AVAILABILITY_CONFLICT', `Limite de ${ed.maxPerOrder} unidade(s) por pedido para a edição ${ed.name}.`, { details: { maxPerOrder: ed.maxPerOrder } })
  return { nftId: nft.id, editionId: ed.id, quantity: qty }
}

function requestHash(input: Partial<CreateOrderInput>): string {
  return JSON.stringify({
    quoteId: input.quoteId,
    walletId: input.walletId,
    network: input.network,
    buyer: input.buyer,
  })
}

/** Cenários que alteram o catálogo no momento da confirmação (aplicados uma vez por cotação) */
const appliedCheckoutScenarios = new Set<string>()

export const commerceHandlers = [
  // ---------- Carrinho ----------
  http.get(`${API}/cart`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const r = resolveCart(request)
    if ('response' in r) return r.response
    return HttpResponse.json<Cart>(toPublicCart(r.cart))
  }),

  http.post(`${API}/cart/items`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const r = resolveCart(request)
    if ('response' in r) return r.response
    const body = await readJson<CartItemInput>(request)
    const existing = r.cart.lines.find((l) => l.nftId === body.nftId && l.editionId === body.editionId)
    const v = validateQuantity(body, existing?.quantity ?? 0)
    if (v instanceof Response) return v
    const ed = findEdition(findNft(v.nftId)!, v.editionId)!
    if (existing) {
      existing.quantity += v.quantity
      existing.acknowledgedPrice = ed.price
    } else r.cart.lines.push({ ...v, acknowledgedPrice: ed.price })
    touch(r.cart)
    return HttpResponse.json<Cart>(toPublicCart(r.cart), { status: 201 })
  }),

  http.patch(`${API}/cart/items/:nftId/:editionId`, async ({ request, params }) => {
    const net = await simulateNetwork()
    if (net) return net
    const r = resolveCart(request)
    if ('response' in r) return r.response
    const line = r.cart.lines.find((l) => l.nftId === params.nftId && l.editionId === params.editionId)
    if (!line) return apiError(404, 'NOT_FOUND', 'Item não está no carrinho.')
    const body = await readJson<{ quantity: number }>(request)
    const v = validateQuantity({ nftId: line.nftId, editionId: line.editionId, quantity: body.quantity })
    if (v instanceof Response) return v
    line.quantity = v.quantity
    touch(r.cart)
    return HttpResponse.json<Cart>(toPublicCart(r.cart))
  }),

  http.delete(`${API}/cart/items/:nftId/:editionId`, async ({ request, params }) => {
    const net = await simulateNetwork()
    if (net) return net
    const r = resolveCart(request)
    if ('response' in r) return r.response
    r.cart.lines = r.cart.lines.filter((l) => !(l.nftId === params.nftId && l.editionId === params.editionId))
    if (r.cart.lines.length === 0) r.cart.couponCode = null
    touch(r.cart)
    return HttpResponse.json<Cart>(toPublicCart(r.cart))
  }),

  /** Usuário confirma que viu as alterações de preço */
  http.post(`${API}/cart/acknowledge`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const r = resolveCart(request)
    if ('response' in r) return r.response
    for (const l of r.cart.lines) {
      const ed = findNft(l.nftId) && findEdition(findNft(l.nftId)!, l.editionId)
      if (ed) l.acknowledgedPrice = ed.price
    }
    touch(r.cart)
    return HttpResponse.json<Cart>(toPublicCart(r.cart))
  }),

  http.put(`${API}/cart/coupon`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const r = resolveCart(request)
    if ('response' in r) return r.response
    const body = await readJson<{ code: string }>(request)
    const code = (body.code ?? '').trim()
    if (!code) return apiError(422, 'VALIDATION_ERROR', 'Informe um cupom.', { fields: { code: 'Informe um cupom.' } })
    if (r.cart.lines.length === 0) return apiError(422, 'VALIDATION_ERROR', 'Adicione itens antes de aplicar um cupom.', { fields: { code: 'Carrinho vazio.' } })
    const check = checkCoupon(code)
    if (!check.ok) {
      const msg = check.code === 'COUPON_EXPIRED' ? 'Este cupom expirou.' : 'Cupom inválido.'
      return apiError(422, check.code, msg, { fields: { code: msg } })
    }
    r.cart.couponCode = check.coupon.code
    touch(r.cart)
    return HttpResponse.json<Cart>(toPublicCart(r.cart))
  }),

  http.delete(`${API}/cart/coupon`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const r = resolveCart(request)
    if ('response' in r) return r.response
    r.cart.couponCode = null
    touch(r.cart)
    return HttpResponse.json<Cart>(toPublicCart(r.cart))
  }),

  /** Mescla o carrinho do visitante no carrinho do usuário autenticado */
  http.post(`${API}/cart/merge`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const body = await readJson<{ guestCartId: string }>(request)
    const s = db()
    const target = getOrCreateCart(auth.user.id, null)
    const guest = body.guestCartId ? s.carts[body.guestCartId] : undefined
    if (guest && guest.ownerId === null && guest.id !== target.id) {
      for (const gl of guest.lines) {
        const nft = findNft(gl.nftId)
        const ed = nft && findEdition(nft, gl.editionId)
        if (!ed) continue
        const existing = target.lines.find((l) => l.nftId === gl.nftId && l.editionId === gl.editionId)
        const cap = Math.max(1, Math.min(ed.maxPerOrder, ed.available || gl.quantity))
        if (existing) {
          existing.quantity = Math.min(cap, existing.quantity + gl.quantity)
          existing.acknowledgedPrice = gl.acknowledgedPrice
        } else target.lines.push({ ...gl, quantity: Math.min(cap, gl.quantity) })
      }
      if (!target.couponCode && guest.couponCode) target.couponCode = guest.couponCode
      delete s.carts[guest.id]
    }
    touch(target)
    return HttpResponse.json<Cart>(toPublicCart(target))
  }),

  // ---------- Cotação ----------
  http.post(`${API}/checkout/quote`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const body = await readJson<QuoteRequest>(request)
    const network = NETWORKS.includes(body.network as Network) ? (body.network as Network) : null
    if (!network) return apiError(422, 'VALIDATION_ERROR', 'Rede inválida.', { fields: { network: 'Selecione uma rede.' } })
    const cart = getOrCreateCart(auth.user.id, null)
    if (cart.lines.length === 0) return apiError(422, 'VALIDATION_ERROR', 'Carrinho vazio.')
    if (cart.couponCode && !checkCoupon(cart.couponCode).ok) {
      cart.couponCode = null
      persist()
    }
    const quote = buildQuote(cart, auth.user.id, network)
    db().quotes[quote.id] = quote
    persist()
    return HttpResponse.json<Quote>(publicQuote(quote))
  }),

  // ---------- Pedidos ----------
  http.post(`${API}/orders`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const key = request.headers.get('idempotency-key')
    if (!key || key.length < 8) return apiError(422, 'VALIDATION_ERROR', 'Header Idempotency-Key obrigatório.')
    const body = await readJson<CreateOrderInput>(request)
    const hash = requestHash(body)
    const s = db()

    // Idempotência: mesma chave + mesmo conteúdo => mesmo pedido
    const previous = s.orders.find((o) => o.userId === auth.user.id && o.idempotencyKey === key)
    if (previous) {
      if (previous.requestHash !== hash) {
        return apiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
      }
      tickOrders()
      return HttpResponse.json<Order>(toPublicOrder(previous), { status: 200 })
    }

    // Validação dos dados do colecionador
    const fields: Record<string, string> = {}
    const buyer = body.buyer
    if (!buyer?.fullName || buyer.fullName.trim().length < 3) fields['buyer.fullName'] = 'Informe o nome completo.'
    if (!buyer?.email || !EMAIL_RE.test(buyer.email)) fields['buyer.email'] = 'E-mail inválido.'
    if (!buyer?.country) fields['buyer.country'] = 'Selecione o país.'
    if (!body.network || !NETWORKS.includes(body.network)) fields.network = 'Selecione uma rede.'
    if (Object.keys(fields).length) return apiError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields })

    const wallet = s.wallets.find((w) => w.id === body.walletId && w.userId === auth.user.id)
    if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
    const conn = s.connections.find((c) => c.connectionId === body.connectionId && c.userId === auth.user.id && c.active)
    if (!conn || conn.walletId !== wallet.id || conn.network !== body.network) {
      return apiError(403, 'FORBIDDEN', 'Carteira desconectada. Conecte a carteira novamente para continuar.')
    }

    const stored = s.quotes[body.quoteId ?? '']
    if (!stored || stored.userId !== auth.user.id) return apiError(404, 'NOT_FOUND', 'Cotação não encontrada.')

    // Cenários de alteração durante a compra
    if (!appliedCheckoutScenarios.has(stored.id) && stored.lines[0]) {
      const first = stored.lines[0]
      if (hasFlag('price-change-on-checkout')) {
        appliedCheckoutScenarios.add(stored.id)
        updateNft(first.nftId, (eds) => {
          const e = eds.find((x) => x.id === first.editionId)
          if (e) e.price = (Math.round(Number(e.price) * 1.1 * 1000) / 1000).toString()
        })
      } else if (hasFlag('sold-out-on-checkout')) {
        appliedCheckoutScenarios.add(stored.id)
        updateNft(first.nftId, (eds) => {
          const e = eds.find((x) => x.id === first.editionId)
          if (e) e.available = 0
        })
      }
    }

    // Revalida preço, disponibilidade, cupom e taxas
    const cart = getOrCreateCart(auth.user.id, null)
    const fresh = buildQuote(cart, auth.user.id, stored.network)
    const expired = new Date(stored.expiresAt).getTime() < Date.now()
    if (expired || !quotesEquivalent(stored, fresh)) {
      s.quotes[fresh.id] = fresh
      appliedCheckoutScenarios.add(fresh.id)
      persist()
      const details: QuoteStaleDetails = {
        previous: publicQuote(stored),
        current: publicQuote(fresh),
        changes: expired ? ['A cotação expirou.', ...diffQuotes(stored, fresh)] : diffQuotes(stored, fresh),
      }
      return apiError(409, 'QUOTE_STALE', 'A cotação mudou. Revise os novos valores e confirme novamente.', { details })
    }

    const now = new Date().toISOString()
    const cfg = getConfig()
    const order: OrderRecord = {
      id: nextId('ord'),
      userId: auth.user.id,
      status: 'pending',
      version: 1,
      lines: stored.lines,
      coupon: stored.coupon,
      subtotal: stored.subtotal,
      discount: stored.discount,
      networkFee: stored.networkFee,
      total: stored.total,
      network: stored.network,
      wallet: { id: wallet.id, label: wallet.label, address: wallet.address, provider: wallet.provider },
      buyer: { fullName: buyer!.fullName.trim(), email: buyer!.email.trim(), country: buyer!.country },
      txHash: null,
      explorerUrl: null,
      declineReason: null,
      createdAt: now,
      updatedAt: now,
      quoteId: stored.id,
      idempotencyKey: key,
      requestHash: hash,
      resolveAt: hasFlag('payment-hold') ? null : Date.now() + cfg.orderResolveMs,
      outcome: hasFlag('payment-declined') ? 'declined' : 'confirmed',
      timeoutPending: hasFlag('order-timeout'),
    }
    s.orders.push(order)
    persist()
    reserveStock(order)

    if (order.timeoutPending) {
      // O pedido foi criado, mas a resposta "se perde": excede o timeout do cliente.
      order.timeoutPending = false
      persist()
      await delay(30_000)
    }
    return HttpResponse.json<Order>(toPublicOrder(order), { status: 201 })
  }),

  http.get(`${API}/orders/:id`, async ({ request, params }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    tickOrders()
    const order = db().orders.find((o) => o.id === params.id)
    if (!order) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado.')
    if (order.userId !== auth.user.id) return apiError(403, 'FORBIDDEN', 'Você não tem acesso a este pedido.')
    return HttpResponse.json<Order>(toPublicOrder(order))
  }),

  http.get(`${API}/orders`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    tickOrders()
    const list = db()
      .orders.filter((o) => o.userId === auth.user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toPublicOrder)
    return HttpResponse.json<Order[]>(list)
  }),

  // ---------- Carteiras ----------
  http.get(`${API}/me/wallets`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const list = db()
      .wallets.filter((w) => w.userId === auth.user.id)
      .sort((a) => (a.kind === 'primary' ? -1 : 1))
      .map(({ userId: _u, ...w }) => w)
    return HttpResponse.json<Wallet[]>(list)
  }),

  http.post(`${API}/me/wallets`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const body = await readJson<WalletInput>(request)
    const v = validateWallet(body)
    if (v) return v
    const s = db()
    if (body.kind === 'primary' && s.wallets.some((w) => w.userId === auth.user.id && w.kind === 'primary')) {
      return apiError(409, 'CONFLICT', 'Você já possui uma carteira principal.', { fields: { kind: 'Já cadastrada. Edite a existente.' } })
    }
    if (s.wallets.some((w) => w.userId === auth.user.id && w.address.toLowerCase() === body.address!.toLowerCase())) {
      return apiError(409, 'CONFLICT', 'Endereço já cadastrado.', { fields: { address: 'Este endereço já está cadastrado.' } })
    }
    const now = new Date().toISOString()
    const w: WalletRecord = {
      id: nextId('w'),
      userId: auth.user.id,
      kind: body.kind!,
      label: body.label!.trim(),
      provider: body.provider!,
      address: body.address!,
      networks: body.networks!,
      createdAt: now,
      updatedAt: now,
    }
    s.wallets.push(w)
    persist()
    const { userId: _u, ...pub } = w
    return HttpResponse.json<Wallet>(pub, { status: 201 })
  }),

  http.patch(`${API}/me/wallets/:id`, async ({ request, params }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const s = db()
    const w = s.wallets.find((x) => x.id === params.id)
    if (!w) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
    if (w.userId !== auth.user.id) return apiError(403, 'FORBIDDEN', 'Sem permissão para esta carteira.')
    const body = await readJson<WalletInput>(request)
    const v = validateWallet({ ...w, ...body })
    if (v) return v
    if (body.address && s.wallets.some((x) => x.userId === auth.user.id && x.id !== w.id && x.address.toLowerCase() === body.address!.toLowerCase())) {
      return apiError(409, 'CONFLICT', 'Endereço já cadastrado.', { fields: { address: 'Este endereço já está cadastrado.' } })
    }
    Object.assign(w, {
      label: body.label?.trim() ?? w.label,
      provider: body.provider ?? w.provider,
      address: body.address ?? w.address,
      networks: body.networks ?? w.networks,
      updatedAt: new Date().toISOString(),
    })
    // Alterações invalidam conexões existentes
    s.connections.forEach((c) => {
      if (c.walletId === w.id) c.active = false
    })
    persist()
    const { userId: _u, ...pub } = w
    return HttpResponse.json<Wallet>(pub)
  }),

  // Conexão simulada da carteira (aprovação/recusa pelo "provedor")
  http.post(`${API}/me/wallets/:id/connect`, async ({ request, params }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const s = db()
    const w = s.wallets.find((x) => x.id === params.id && x.userId === auth.user.id)
    if (!w) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
    const body = await readJson<{ network: Network }>(request)
    if (!body.network || !w.networks.includes(body.network)) {
      return apiError(422, 'VALIDATION_ERROR', 'Esta carteira não suporta a rede selecionada.', { fields: { network: 'Rede não suportada por esta carteira.' } })
    }
    await delay(getConfig().network === 'instant' ? 0 : 600)
    if (hasFlag('wallet-reject')) return apiError(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
    s.connections.forEach((c) => {
      if (c.userId === auth.user.id) c.active = false
    })
    const connection = { connectionId: nextId('conn'), walletId: w.id, userId: auth.user.id, network: body.network, connectedAt: new Date().toISOString(), active: true }
    s.connections.push(connection)
    persist()
    return HttpResponse.json<WalletConnection>({ walletId: w.id, network: body.network, connectionId: connection.connectionId, connectedAt: connection.connectedAt })
  }),

  http.delete(`${API}/me/wallets/:id/connect`, async ({ request, params }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    db().connections.forEach((c) => {
      if (c.userId === auth.user.id && c.walletId === params.id) c.active = false
    })
    persist()
    return new HttpResponse(null, { status: 204 })
  }),
]

function validateWallet(body: Partial<WalletInput>): Response | null {
  const fields: Record<string, string> = {}
  if (body.kind !== 'primary' && body.kind !== 'secondary') fields.kind = 'Selecione o tipo.'
  if (!body.label || body.label.trim().length < 2) fields.label = 'Informe um nome com pelo menos 2 caracteres.'
  if (!body.provider || !['metamask', 'coinbase', 'walletconnect'].includes(body.provider)) fields.provider = 'Selecione o provedor.'
  if (!body.address || !ADDRESS_RE.test(body.address)) fields.address = 'Endereço inválido. Use 0x seguido de 40 caracteres hexadecimais.'
  if (!body.networks?.length || body.networks.some((n) => !NETWORKS.includes(n))) fields.networks = 'Selecione ao menos uma rede.'
  if (Object.keys(fields).length) return apiError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields })
  return null
}

export function resetCommerceCounters() {
  appliedCheckoutScenarios.clear()
}

