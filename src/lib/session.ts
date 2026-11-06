import { useSyncExternalStore } from 'react'
import type { BuyerInfo, Network, Session, User, WalletConnection } from '@/lib/api/contracts'

const SESSION_KEY = 'nft.session'
const GUEST_CART_KEY = 'nft.guest.cartId'
const CHECKOUT_DRAFT_KEY = 'nft.checkout.draft'
const PENDING_ORDER_KEY = 'nft.checkout.pendingOrder'

export interface CheckoutDraft {
  buyer: BuyerInfo
  network: Network
  walletId: string
  ensName?: string
  referralCode?: string
  note?: string
}

export interface PendingOrderSubmission {
  idempotencyKey: string
  quoteId: string
  walletId: string
  connectionId: string
  network: Network
  buyer: BuyerInfo
  orderId?: string
  createdAt: string
}

interface AuthSnapshot {
  session: Session | null
  guestCartId: string
  expiredNotice: string | null
  walletConnection: WalletConnection | null
}

function createGuestCartId(): string {
  return `guest-${crypto.randomUUID().slice(0, 12)}`
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    if (!parsed?.token || !parsed?.user?.id) return null
    return parsed
  } catch {
    return null
  }
}

function loadGuestCartId(): string {
  try {
    const existing = localStorage.getItem(GUEST_CART_KEY)
    if (existing) return existing
    const next = createGuestCartId()
    localStorage.setItem(GUEST_CART_KEY, next)
    return next
  } catch {
    return createGuestCartId()
  }
}

let snapshot: AuthSnapshot = {
  session: loadSession(),
  guestCartId: loadGuestCartId(),
  expiredNotice: null,
  walletConnection: null,
}

const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export const sessionStore = {
  getSnapshot(): AuthSnapshot {
    return snapshot
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getToken(): string | null {
    return snapshot.session?.token ?? null
  },
  getUser(): User | null {
    return snapshot.session?.user ?? null
  },
  getGuestCartId(): string {
    return snapshot.guestCartId
  },
  setSession(session: Session | null) {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } else {
      localStorage.removeItem(SESSION_KEY)
    }
    snapshot = {
      ...snapshot,
      session,
      expiredNotice: null,
      walletConnection: session ? snapshot.walletConnection : null,
    }
    emit()
  },
  updateUser(user: User) {
    if (!snapshot.session) return
    const next: Session = { ...snapshot.session, user }
    localStorage.setItem(SESSION_KEY, JSON.stringify(next))
    snapshot = { ...snapshot, session: next }
    emit()
  },
  rotateGuestCartId(): string {
    const next = createGuestCartId()
    localStorage.setItem(GUEST_CART_KEY, next)
    snapshot = { ...snapshot, guestCartId: next }
    emit()
    return next
  },
  markSessionExpired(message = 'Sua sessão expirou. Faça login novamente para continuar de onde parou.') {
    localStorage.removeItem(SESSION_KEY)
    snapshot = {
      ...snapshot,
      session: null,
      expiredNotice: message,
      walletConnection: null,
    }
    emit()
  },
  clearExpiredNotice() {
    if (!snapshot.expiredNotice) return
    snapshot = { ...snapshot, expiredNotice: null }
    emit()
  },
  setWalletConnection(conn: WalletConnection | null) {
    snapshot = { ...snapshot, walletConnection: conn }
    emit()
  },
  resetAll() {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(CHECKOUT_DRAFT_KEY)
    localStorage.removeItem(PENDING_ORDER_KEY)
    const guestCartId = createGuestCartId()
    localStorage.setItem(GUEST_CART_KEY, guestCartId)
    snapshot = {
      session: null,
      guestCartId,
      expiredNotice: null,
      walletConnection: null,
    }
    emit()
  },
}

export function useAuthSnapshot(): AuthSnapshot {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot, sessionStore.getSnapshot)
}

export function saveCheckoutDraft(draft: CheckoutDraft) {
  try {
    localStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

export function loadCheckoutDraft(): CheckoutDraft | null {
  try {
    const raw = localStorage.getItem(CHECKOUT_DRAFT_KEY)
    return raw ? (JSON.parse(raw) as CheckoutDraft) : null
  } catch {
    return null
  }
}

export function clearCheckoutDraft() {
  try {
    localStorage.removeItem(CHECKOUT_DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

export function savePendingOrderSubmission(sub: PendingOrderSubmission | null) {
  try {
    if (!sub) localStorage.removeItem(PENDING_ORDER_KEY)
    else localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(sub))
  } catch {
    /* ignore */
  }
}

export function loadPendingOrderSubmission(): PendingOrderSubmission | null {
  try {
    const raw = localStorage.getItem(PENDING_ORDER_KEY)
    return raw ? (JSON.parse(raw) as PendingOrderSubmission) : null
  } catch {
    return null
  }
}

