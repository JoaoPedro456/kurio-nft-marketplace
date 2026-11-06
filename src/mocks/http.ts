import { HttpResponse } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/lib/api/contracts'
import { db, persist, type UserRecord } from './db'

export const API = '/api'

export function apiError(status: number, code: ApiErrorCode, message: string, extra: { fields?: Record<string, string>; details?: unknown } = {}) {
  return HttpResponse.json<ApiErrorBody>({ error: { code, message, ...extra } }, { status })
}

export const SESSION_TTL_MS = 2 * 60 * 60_000
export const SHORT_SESSION_TTL_MS = 60_000

export type AuthResult = { ok: true; user: UserRecord; token: string } | { ok: false; response: Response }

/** Resolve a sessão a partir do header Authorization: Bearer <token>. */
export function authenticate(request: Request): AuthResult {
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return { ok: false, response: apiError(401, 'UNAUTHENTICATED', 'Autenticação necessária.') }
  const s = db()
  const session = s.sessions.find((x) => x.token === token)
  if (!session || session.revoked) return { ok: false, response: apiError(401, 'UNAUTHENTICATED', 'Sessão inválida.') }
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return { ok: false, response: apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.') }
  }
  const user = s.users.find((u) => u.id === session.userId)
  if (!user) return { ok: false, response: apiError(401, 'UNAUTHENTICATED', 'Sessão inválida.') }
  return { ok: true, user, token }
}

/** Usuário opcional (rotas públicas que se comportam diferente com sessão). */
export function optionalAuth(request: Request): AuthResult | null {
  if (!request.headers.get('authorization')) return null
  return authenticate(request)
}

/** Expira todas as sessões ativas (controle de cenário). */
export function expireAllSessions() {
  const past = new Date(Date.now() - 1000).toISOString()
  for (const s of db().sessions) if (!s.revoked) s.expiresAt = past
  persist()
}

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>
  } catch {
    return {}
  }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/
export const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export function passwordProblem(pw: string | undefined): string | null {
  if (!pw || pw.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) return 'Use letras maiúsculas, minúsculas e números.'
  return null
}
