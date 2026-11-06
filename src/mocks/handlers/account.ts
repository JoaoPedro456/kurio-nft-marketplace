import { http, HttpResponse } from 'msw'
import type {
  ChangePasswordInput,
  FavoritesResponse,
  LoginInput,
  Network,
  Nft,
  NftCategory,
  NftListQuery,
  Paginated,
  RegisterInput,
  Session,
  UpdateProfileInput,
  User,
} from '@/lib/api/contracts'
import { cmp } from '@/lib/money'
import { hasFlag } from '../config'
import { db, hashPassword, nextId, persist, randomToken, toPublicUser } from '../db'
import { findNft } from '../domain'
import {
  API,
  apiError,
  authenticate,
  EMAIL_RE,
  passwordProblem,
  readJson,
  SESSION_TTL_MS,
  SHORT_SESSION_TTL_MS,
  USERNAME_RE,
} from '../http'
import { simulateNetwork } from '../network'

function createSession(userId: string): Session {
  const s = db()
  const token = randomToken()
  const ttl = hasFlag('short-session') ? SHORT_SESSION_TTL_MS : SESSION_TTL_MS
  const expiresAt = new Date(Date.now() + ttl).toISOString()
  s.sessions.push({ token, userId, expiresAt, revoked: false })
  persist()
  const user = s.users.find((u) => u.id === userId)!
  return { token, expiresAt, user: toPublicUser(user) }
}

const CATEGORIES: NftCategory[] = ['art', 'collectibles', 'music', 'photography', 'gaming', 'sports']
const NETWORKS: Network[] = ['ethereum', 'polygon', 'arbitrum']

function parseListQuery(url: URL): Required<Omit<NftListQuery, 'minPrice' | 'maxPrice'>> & { minPrice?: string; maxPrice?: string } {
  const p = url.searchParams
  const category = p
    .getAll('category')
    .flatMap((c) => c.split(','))
    .filter((c): c is NftCategory => CATEGORIES.includes(c as NftCategory))
  const network = p
    .getAll('network')
    .flatMap((n) => n.split(','))
    .filter((n): n is Network => NETWORKS.includes(n as Network))
  const page = Math.max(1, Number(p.get('page')) || 1)
  const pageSize = Math.min(48, Math.max(1, Number(p.get('pageSize')) || 9))
  const sort = (['recent', 'price-asc', 'price-desc', 'popular'] as const).find((s) => s === p.get('sort')) ?? 'recent'
  const availability = (['all', 'available', 'sold-out'] as const).find((s) => s === p.get('availability')) ?? 'all'
  const num = (v: string | null) => (v && /^\d+(\.\d+)?$/.test(v) ? v : undefined)
  return { q: (p.get('q') ?? '').trim(), category, network, page, pageSize, sort, availability, minPrice: num(p.get('minPrice')), maxPrice: num(p.get('maxPrice')) }
}

let catalogFailures = 0

export const authHandlers = [
  http.post(`${API}/auth/register`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const body = await readJson<RegisterInput>(request)
    const fields: Record<string, string> = {}
    const name = body.name?.trim() ?? ''
    const username = body.username?.trim().toLowerCase() ?? ''
    const email = body.email?.trim().toLowerCase() ?? ''
    if (name.length < 2) fields.name = 'Informe seu nome.'
    if (!USERNAME_RE.test(username)) fields.username = 'Use 3 a 20 caracteres: letras minúsculas, números ou _.'
    if (!EMAIL_RE.test(email)) fields.email = 'E-mail inválido.'
    const pw = passwordProblem(body.password)
    if (pw) fields.password = pw
    if (Object.keys(fields).length) return apiError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields })
    const s = db()
    const conflict: Record<string, string> = {}
    if (s.users.some((u) => u.email === email)) conflict.email = 'Este e-mail já está cadastrado.'
    if (s.users.some((u) => u.username === username)) conflict.username = 'Este nome de usuário já está em uso.'
    if (Object.keys(conflict).length) return apiError(409, 'CONFLICT', 'Conta já existente.', { fields: conflict })
    const id = nextId('u')
    const salt = randomToken().slice(0, 16)
    s.users.push({
      id,
      name,
      username,
      email,
      bio: '',
      avatarUrl: null,
      createdAt: new Date().toISOString(),
      salt,
      passwordHash: await hashPassword(body.password!, salt),
    })
    persist()
    return HttpResponse.json<Session>(createSession(id), { status: 201 })
  }),

  http.post(`${API}/auth/login`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const body = await readJson<LoginInput>(request)
    const email = body.email?.trim().toLowerCase() ?? ''
    const fields: Record<string, string> = {}
    if (!EMAIL_RE.test(email)) fields.email = 'E-mail inválido.'
    if (!body.password) fields.password = 'Informe a senha.'
    if (Object.keys(fields).length) return apiError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields })
    const user = db().users.find((u) => u.email === email)
    if (!user || (await hashPassword(body.password!, user.salt)) !== user.passwordHash) {
      return apiError(401, 'UNAUTHENTICATED', 'E-mail ou senha incorretos.')
    }
    return HttpResponse.json<Session>(createSession(user.id))
  }),

  http.get(`${API}/auth/session`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const session = db().sessions.find((s) => s.token === auth.token)!
    return HttpResponse.json<Session>({ token: auth.token, expiresAt: session.expiresAt, user: toPublicUser(auth.user) })
  }),

  http.post(`${API}/auth/logout`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (auth.ok) {
      const s = db().sessions.find((x) => x.token === auth.token)
      if (s) s.revoked = true
      db().connections.forEach((c) => {
        if (c.userId === auth.user.id) c.active = false
      })
      persist()
    }
    return new HttpResponse(null, { status: 204 })
  }),

  // ---------- Perfil ----------
  http.get(`${API}/me/profile`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    return HttpResponse.json<User>(toPublicUser(auth.user))
  }),

  http.patch(`${API}/me/profile`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    if (hasFlag('profile-error')) return apiError(503, 'SERVICE_UNAVAILABLE', 'Serviço de perfil indisponível. Tente novamente.')
    const body = await readJson<UpdateProfileInput>(request)
    const fields: Record<string, string> = {}
    const name = body.name?.trim() ?? ''
    const username = body.username?.trim().toLowerCase() ?? ''
    const email = body.email?.trim().toLowerCase() ?? ''
    const bio = body.bio?.trim() ?? ''
    if (name.length < 2) fields.name = 'Informe seu nome.'
    if (!USERNAME_RE.test(username)) fields.username = 'Use 3 a 20 caracteres: letras minúsculas, números ou _.'
    if (!EMAIL_RE.test(email)) fields.email = 'E-mail inválido.'
    if (bio.length > 280) fields.bio = 'A bio deve ter no máximo 280 caracteres.'
    if (Object.keys(fields).length) return apiError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields })
    const others = db().users.filter((u) => u.id !== auth.user.id)
    if (others.some((u) => u.email === email)) fields.email = 'Este e-mail já está cadastrado.'
    if (others.some((u) => u.username === username)) fields.username = 'Este nome de usuário já está em uso.'
    if (Object.keys(fields).length) return apiError(409, 'CONFLICT', 'Dados em conflito com outra conta.', { fields })
    Object.assign(auth.user, { name, username, email, bio })
    persist()
    return HttpResponse.json<User>(toPublicUser(auth.user))
  }),

  http.put(`${API}/me/avatar`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const body = await readJson<{ dataUrl: string | null }>(request)
    if (body.dataUrl === null) {
      auth.user.avatarUrl = null
    } else {
      if (typeof body.dataUrl !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(body.dataUrl)) {
        return apiError(422, 'VALIDATION_ERROR', 'Formato de imagem inválido.', { fields: { avatar: 'Envie PNG, JPG, WEBP ou GIF.' } })
      }
      if (body.dataUrl.length > 700_000) {
        return apiError(422, 'VALIDATION_ERROR', 'Imagem muito grande.', { fields: { avatar: 'A imagem deve ter no máximo 500 KB.' } })
      }
      auth.user.avatarUrl = body.dataUrl
    }
    persist()
    return HttpResponse.json<User>(toPublicUser(auth.user))
  }),

  http.post(`${API}/me/password`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const body = await readJson<ChangePasswordInput>(request)
    const fields: Record<string, string> = {}
    if (!body.currentPassword) fields.currentPassword = 'Informe a senha atual.'
    const pw = passwordProblem(body.newPassword)
    if (pw) fields.newPassword = pw
    if (Object.keys(fields).length) return apiError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields })
    if ((await hashPassword(body.currentPassword!, auth.user.salt)) !== auth.user.passwordHash) {
      return apiError(422, 'VALIDATION_ERROR', 'Senha atual incorreta.', { fields: { currentPassword: 'Senha atual incorreta.' } })
    }
    if (body.currentPassword === body.newPassword) {
      return apiError(422, 'VALIDATION_ERROR', 'A nova senha deve ser diferente.', { fields: { newPassword: 'A nova senha deve ser diferente da atual.' } })
    }
    auth.user.salt = randomToken().slice(0, 16)
    auth.user.passwordHash = await hashPassword(body.newPassword!, auth.user.salt)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),
]

export const catalogHandlers = [
  http.get(`${API}/nfts`, async ({ request }) => {
    const net = await simulateNetwork({ outOfOrder: true })
    if (net) return net
    if (hasFlag('catalog-error')) return apiError(500, 'INTERNAL_ERROR', 'Erro interno ao listar NFTs.')
    if (hasFlag('catalog-error-transient') && catalogFailures < 2) {
      catalogFailures++
      return apiError(503, 'SERVICE_UNAVAILABLE', 'Catálogo temporariamente indisponível.')
    }
    const q = parseListQuery(new URL(request.url))
    let list = hasFlag('empty-catalog') ? [] : [...db().nfts]
    if (q.q) {
      const term = q.q.toLowerCase()
      list = list.filter((n) => [n.name, n.collection, n.creator.name, ...n.tags].some((s) => s.toLowerCase().includes(term)))
    }
    if (q.category.length) list = list.filter((n) => q.category.includes(n.category))
    if (q.network.length) list = list.filter((n) => n.network && q.network.includes(n.network))
    if (q.availability === 'available') list = list.filter((n) => n.totalAvailable > 0)
    if (q.availability === 'sold-out') list = list.filter((n) => n.totalAvailable === 0)
    if (q.minPrice) list = list.filter((n) => cmp(n.floorPrice, q.minPrice!) >= 0)
    if (q.maxPrice) list = list.filter((n) => cmp(n.floorPrice, q.maxPrice!) <= 0)
    const sorters: Record<typeof q.sort, (a: Nft, b: Nft) => number> = {
      recent: (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
      'price-asc': (a, b) => cmp(a.floorPrice, b.floorPrice) || a.id.localeCompare(b.id),
      'price-desc': (a, b) => cmp(b.floorPrice, a.floorPrice) || a.id.localeCompare(b.id),
      popular: (a, b) => b.likes - a.likes || a.id.localeCompare(b.id),
    }
    list.sort(sorters[q.sort])
    const total = list.length
    const totalPages = Math.max(1, Math.ceil(total / q.pageSize))
    const start = (q.page - 1) * q.pageSize
    return HttpResponse.json<Paginated<Nft>>({ items: list.slice(start, start + q.pageSize), page: q.page, pageSize: q.pageSize, total, totalPages })
  }),

  http.get(`${API}/nfts/featured`, async () => {
    const net = await simulateNetwork()
    if (net) return net
    if (hasFlag('empty-catalog')) return HttpResponse.json<Nft[]>([])
    const list = [...db().nfts].sort((a, b) => b.likes - a.likes || a.id.localeCompare(b.id)).slice(0, 3)
    return HttpResponse.json<Nft[]>(list)
  }),

  http.get(`${API}/nfts/:id`, async ({ params }) => {
    const net = await simulateNetwork()
    if (net) return net
    const nft = findNft(String(params.id))
    if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
    return HttpResponse.json<Nft>(nft)
  }),

  // ---------- Favoritos ----------
  http.get(`${API}/me/favorites`, async ({ request }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    return HttpResponse.json<FavoritesResponse>({ nftIds: db().favorites[auth.user.id] ?? [] })
  }),

  http.put(`${API}/me/favorites/:nftId`, async ({ request, params }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    if (hasFlag('favorites-fail')) return apiError(500, 'INTERNAL_ERROR', 'Não foi possível salvar o favorito.')
    const nft = findNft(String(params.nftId))
    if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
    const s = db()
    const list = new Set(s.favorites[auth.user.id] ?? [])
    list.add(nft.id)
    s.favorites[auth.user.id] = [...list]
    persist()
    return HttpResponse.json<FavoritesResponse>({ nftIds: s.favorites[auth.user.id] })
  }),

  http.delete(`${API}/me/favorites/:nftId`, async ({ request, params }) => {
    const net = await simulateNetwork()
    if (net) return net
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    if (hasFlag('favorites-fail')) return apiError(500, 'INTERNAL_ERROR', 'Não foi possível remover o favorito.')
    const s = db()
    s.favorites[auth.user.id] = (s.favorites[auth.user.id] ?? []).filter((id) => id !== String(params.nftId))
    persist()
    return HttpResponse.json<FavoritesResponse>({ nftIds: s.favorites[auth.user.id] })
  }),
]

/** Reinicia contadores voláteis de cenário */
export function resetCatalogCounters() {
  catalogFailures = 0
}
