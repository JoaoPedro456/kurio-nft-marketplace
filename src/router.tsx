import { lazy, Suspense } from 'react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { Layout } from '@/components/Layout'
import { HomePage } from '@/pages/HomePage'
import { NftDetailPage } from '@/pages/NftDetailPage'

const MockDevbar = lazy(() =>
  import('@/components/MockDevbar').then((m) => ({ default: m.MockDevbar })),
)
const AccountPage = lazy(() =>
  import('@/pages/AccountPage').then((m) => ({ default: m.AccountPage })),
)
const AuthPage = lazy(() =>
  import('@/pages/AuthPage').then((m) => ({ default: m.AuthPage })),
)
const CartPage = lazy(() =>
  import('@/pages/CartPage').then((m) => ({ default: m.CartPage })),
)
const CheckoutPage = lazy(() =>
  import('@/pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })),
)
const OrderPage = lazy(() =>
  import('@/pages/OrderPage').then((m) => ({ default: m.OrderPage })),
)

export interface HomeSearch {
  q?: string
  category?: string
  network?: string
  availability?: string
  minPrice?: string
  maxPrice?: string
  sort?: string
  page?: number
}

const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Suspense fallback={<div className="min-h-[60vh]" />}>
        <Outlet />
      </Suspense>
      <Suspense fallback={null}>
        <MockDevbar />
      </Suspense>
    </Layout>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): HomeSearch => {
    const out: HomeSearch = {}
    if (typeof search.q === 'string' && search.q) out.q = search.q
    if (typeof search.category === 'string' && search.category) out.category = search.category
    if (typeof search.network === 'string' && search.network) out.network = search.network
    if (typeof search.availability === 'string' && search.availability)
      out.availability = search.availability
    if (typeof search.minPrice === 'string' && search.minPrice) out.minPrice = search.minPrice
    if (typeof search.maxPrice === 'string' && search.maxPrice) out.maxPrice = search.maxPrice
    if (typeof search.sort === 'string' && search.sort) out.sort = search.sort
    if (search.page !== undefined && Number(search.page) > 0) out.page = Number(search.page)
    return out
  },
  component: HomePage,
})

const nftDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nfts/$nftId',
  component: NftDetailPage,
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cart',
  component: CartPage,
})

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  component: CheckoutPage,
})

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/$orderId',
  component: OrderPage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const out: { redirect?: string } = {}
    if (typeof search.redirect === 'string' && search.redirect) out.redirect = search.redirect
    return out
  },
  component: AuthPage,
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const out: { redirect?: string } = {}
    if (typeof search.redirect === 'string' && search.redirect) out.redirect = search.redirect
    return out
  },
  component: AuthPage,
})

const accountIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account',
  beforeLoad: () => {
    throw redirect({ to: '/account/profile' })
  },
})

const accountProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account/profile',
  component: AccountPage,
})

const accountWalletsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account/wallets',
  component: AccountPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  nftDetailRoute,
  cartRoute,
  checkoutRoute,
  orderRoute,
  loginRoute,
  registerRoute,
  accountIndexRoute,
  accountProfileRoute,
  accountWalletsRoute,
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
