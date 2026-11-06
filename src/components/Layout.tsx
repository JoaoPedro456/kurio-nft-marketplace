import { useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  Heart,
  Home,
  LogIn,
  LogOut,
  Search,
  ShoppingBag,
  Sparkles,
  User as UserIcon,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useCartQuery, useFavoritesQuery } from '@/lib/hooks'
import { clearUserScopedCache, queryClient } from '@/lib/query'
import { reconnectRealtimeNow, useRealtimeState } from '@/lib/realtime'
import { sessionStore, useAuthSnapshot } from '@/lib/session'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { session, expiredNotice } = useAuthSnapshot()
  const realtime = useRealtimeState()
  const { data: cart } = useCartQuery()
  const { data: favorites } = useFavoritesQuery()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')

  const cartCount = cart?.summary.itemCount ?? cart?.items.reduce((acc, item) => acc + item.quantity, 0) ?? 0
  const favCount = favorites?.nftIds.length ?? 0

  const pathname = location.pathname
  const showHeaderDivider =
    pathname === '/' ||
    pathname.startsWith('/account') ||
    pathname === '/login' ||
    pathname === '/register'

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = searchInput.trim()
    navigate({
      to: '/',
      search: (prev) => ({
        ...prev,
        q: trimmed || undefined,
        page: 1,
      }),
    })
    setSearchOpen(false)
  }

  const handleLogout = async () => {
    try {
      await api.logout()
    } catch {
      /* ignore network failure on logout */
    }
    sessionStore.setSession(null)
    sessionStore.rotateGuestCartId()
    clearUserScopedCache(queryClient)
    queryClient.invalidateQueries({ queryKey: ['cart'] })
    reconnectRealtimeNow()
    toast.success('Você saiu da sua conta.')
    if (
      pathname.startsWith('/checkout') ||
      pathname.startsWith('/account') ||
      pathname.startsWith('/orders')
    ) {
      navigate({ to: '/' })
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#140D0A] text-[#F5F1EB] selection:bg-[#D28A4C] selection:text-[#140D0A]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-[#D28A4C] focus:text-[#140D0A] focus:px-4 focus:py-2 focus:rounded-md focus:font-bold"
      >
        Pular para o conteúdo principal
      </a>

      {/* Session expired banner */}
      {expiredNotice && (
        <div
          role="alert"
          data-testid="session-expired-banner"
          className="bg-[#38220F] border-b border-[#F0805F]/50 px-4 py-2.5 text-xs text-[#F5F1EB]"
        >
          <div className="max-w-[1200px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F0805F] shrink-0" />
              <span>{expiredNotice}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                search={{ redirect: pathname }}
                onClick={() => sessionStore.clearExpiredNotice()}
                className="px-3 py-1 rounded bg-[#D28A4C] text-[#140D0A] font-bold hover:bg-[#E89B55] transition-colors"
              >
                Fazer login novamente
              </Link>
              <button
                type="button"
                aria-label="Fechar aviso de sessão"
                onClick={() => sessionStore.clearExpiredNotice()}
                className="p-1 text-[#CFB28C] hover:text-[#F5F1EB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Realtime status bar when disconnected or reconnecting */}
      {realtime.status !== 'connected' && (
        <div
          role="status"
          data-testid="realtime-disconnected-banner"
          className="bg-[#2F1D15] border-b border-[#D28A4C]/40 px-4 py-1.5 text-xs text-[#CFB28C]"
        >
          <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <WifiOff className="w-3.5 h-3.5 text-[#F0805F]" />
              Conexão em tempo real em reconexão. Sincronizando dados automaticamente...
            </span>
            <button
              type="button"
              onClick={() => reconnectRealtimeNow()}
              className="underline text-[#E89B55] hover:text-[#F5F1EB] font-bold"
            >
              Reconectar agora
            </button>
          </div>
        </div>
      )}

      {/* Main Header */}
      <header
        className={`sticky top-0 z-30 bg-[#140D0A]/95 backdrop-blur-sm ${
          showHeaderDivider ? 'border-b border-[#3F2319]' : ''
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-[74px] flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-[#F5F1EB] font-bold text-sm tracking-[1.4px] uppercase py-2 focus-visible:outline-none"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#D28A4C] inline-block" />
            <span>KURIO</span>
          </Link>

          <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-8 h-full">
            <Link
              to="/"
              className={`relative h-full flex items-center text-sm transition-colors ${
                pathname === '/'
                  ? 'text-[#F5F1EB] font-bold'
                  : 'text-[#CFB28C] hover:text-[#F5F1EB]'
              }`}
            >
              Início
              {pathname === '/' && (
                <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#D28A4C]" />
              )}
            </Link>
            <Link
              to="/"
              search={{ sort: 'recent' }}
              className={`relative h-full flex items-center text-sm transition-colors ${
                pathname.startsWith('/nfts') ||
                pathname.startsWith('/cart') ||
                pathname.startsWith('/checkout')
                  ? 'text-[#F5F1EB] font-bold'
                  : 'text-[#CFB28C] hover:text-[#F5F1EB]'
              }`}
            >
              Mercado
              {(pathname.startsWith('/nfts') ||
                pathname.startsWith('/cart') ||
                pathname.startsWith('/checkout')) && (
                <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#D28A4C]" />
              )}
            </Link>
            <a
              href="#criadores"
              onClick={(e) => {
                if (pathname !== '/') {
                  e.preventDefault()
                  navigate({ to: '/' })
                }
              }}
              className="relative h-full flex items-center text-sm text-[#CFB28C] hover:text-[#F5F1EB] transition-colors"
            >
              Criadores
            </a>
            <a
              href="#diario-cunhagem"
              onClick={(e) => {
                if (pathname !== '/') {
                  e.preventDefault()
                  navigate({ to: '/' })
                }
              }}
              className="relative h-full flex items-center text-sm text-[#CFB28C] hover:text-[#F5F1EB] transition-colors"
            >
              Aprenda
            </a>
          </nav>

          <div className="flex items-center gap-3 sm:gap-4">
            <div
              data-testid="realtime-status"
              data-status={realtime.status}
              title={
                realtime.status === 'connected'
                  ? 'Socket.IO conectado em tempo real'
                  : 'Socket.IO reconectando'
              }
              className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-[#241612] border border-[#3F2319] text-[11px] text-[#CFB28C]"
            >
              {realtime.status === 'connected' ? (
                <>
                  <Wifi className="w-3 h-3 text-[#4E9B6F]" />
                  <span>Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-[#F0805F]" />
                  <span>Offline</span>
                </>
              )}
            </div>

            <button
              type="button"
              aria-label="Abrir busca rápida"
              onClick={() => setSearchOpen((v) => !v)}
              className="w-11 h-11 flex items-center justify-center rounded-md text-[#F5F1EB] hover:bg-[#241612] transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>

            {session && (
              <Link
                to="/account/profile"
                aria-label={`Favoritos (${favCount})`}
                data-testid="header-favorites-link"
                className="relative w-11 h-11 hidden sm:flex items-center justify-center rounded-md text-[#F5F1EB] hover:bg-[#241612] transition-colors"
              >
                <Heart className="w-5 h-5 text-[#E89B55]" />
                {favCount > 0 && (
                  <span
                    aria-hidden="true"
                    data-testid="header-favorites-badge"
                    className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#2F1D15] border border-[#D28A4C] text-[#E89B55] text-[10px] font-bold flex items-center justify-center"
                  >
                    {favCount}
                  </span>
                )}
              </Link>
            )}

            <Link
              to="/cart"
              aria-label={`Carrinho de compras (${cartCount} itens)`}
              data-testid="header-cart-link"
              className="relative w-11 h-11 flex items-center justify-center rounded-md text-[#F5F1EB] hover:bg-[#241612] transition-colors"
            >
              <ShoppingBag className="w-5 h-5" />
              <span
                aria-hidden="true"
                data-testid="header-cart-badge"
                className="absolute top-1.5 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D28A4C] text-[#140D0A] text-[10px] font-bold flex items-center justify-center"
              >
                {cartCount}
              </span>
            </Link>

            {session ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/account/profile"
                  data-testid="header-user-link"
                  className="h-9 px-3 rounded-md bg-[#241612] border border-[#3F2319] hover:border-[#D28A4C] text-xs font-bold text-[#F5F1EB] flex items-center gap-2 transition-colors"
                >
                  {session.user.avatarUrl ? (
                    <img
                      src={session.user.avatarUrl}
                      alt={session.user.name}
                      width={20}
                      height={20}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <UserIcon className="w-4 h-4 text-[#E89B55]" />
                  )}
                  <span className="max-w-[110px] truncate">{session.user.name}</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  data-testid="header-logout-btn"
                  aria-label="Sair da conta"
                  title="Sair da conta"
                  className="w-9 h-9 rounded-md bg-[#241612] border border-[#3F2319] hover:border-[#F0805F] text-[#CFB28C] hover:text-[#F0805F] flex items-center justify-center transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                data-testid="header-login-link"
                className="h-[35px] px-4 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-medium text-sm flex items-center gap-1.5 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>Entrar</span>
              </Link>
            )}
          </div>
        </div>

        {searchOpen && (
          <div className="border-t border-[#3F2319] bg-[#241612] px-4 py-3">
            <form
              onSubmit={handleSearchSubmit}
              className="max-w-[1200px] mx-auto flex items-center gap-2"
            >
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por nome do NFT, coleção ou criador..."
                aria-label="Buscar NFTs"
                autoFocus
                className="flex-1 h-10 px-3.5 rounded-[5px] bg-[#140D0A] border border-[#3F2319] text-sm text-[#F5F1EB] placeholder-[#B39463] focus:border-[#D28A4C] focus:outline-none"
              />
              <button
                type="submit"
                className="h-10 px-4 rounded-[5px] bg-[#D28A4C] text-[#140D0A] font-bold text-xs uppercase hover:bg-[#E89B55] transition-colors"
              >
                Buscar
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Fechar busca"
                className="h-10 px-3 rounded-[5px] border border-[#3F2319] text-xs text-[#CFB28C] hover:text-[#F5F1EB]"
              >
                Fechar
              </button>
            </form>
          </div>
        )}
      </header>

      <main id="main-content" className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      <footer className="mt-16 bg-[#241612] border-t border-[#3F2319] text-[#CFB28C] pb-20 md:pb-0">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 border-b border-[#3F2319] grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-3 space-y-2">
            <div className="flex items-center gap-2 text-[#E89B55] font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Custódia verificada</span>
            </div>
            <p className="text-xs leading-5 text-[#CFB28C]">
              Contratos inteligentes auditados e autenticidade on-chain garantida em cada edição.
            </p>
          </div>
          <div className="md:col-span-3 space-y-2">
            <div className="flex items-center gap-2 text-[#E89B55] font-bold text-sm">
              <Wallet className="w-4 h-4" />
              <span>Liquidação instantânea</span>
            </div>
            <p className="text-xs leading-5 text-[#CFB28C]">
              Cotações em ETH em tempo real e proteção contra variação brusca de gás.
            </p>
          </div>
          <div className="md:col-span-6 space-y-2">
            <h2 className="text-sm font-bold text-[#F5F1EB]">Assine a newsletter da Kurio</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                toast.success('Inscrição confirmada na newsletter da Kurio!')
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <label htmlFor="newsletter-email" className="sr-only">
                Seu e-mail para newsletter
              </label>
              <input
                id="newsletter-email"
                type="email"
                required
                placeholder="Digite seu e-mail..."
                className="flex-1 h-10 px-3.5 rounded-[5px] bg-[#140D0A] border border-[#3F2319] text-xs text-[#F5F1EB] placeholder-[#B39463] focus:border-[#D28A4C] focus:outline-none"
              />
              <button
                type="submit"
                className="h-10 px-5 rounded-[5px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-xs uppercase transition-colors"
              >
                Participar
              </button>
            </form>
            <p className="text-[11px] leading-4 text-[#B39463]">
              Receba alertas de drops gênesis, leilões raros e análises de curadoria semanalmente.
            </p>
          </div>
        </div>

        <div className="bg-[#2F1D15]/70 border-b border-[#3F2319]">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <span className="font-bold tracking-[1.2px] text-[#F5F1EB] uppercase">KURIO</span>
            <span>Kurio Labs • Av. Paulista, 1000 • São Paulo, SP</span>
            <span>suporte@kurio.art</span>
            <span>Discord • @kurio_nft</span>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-xs">
          <div>
            <h3 className="text-sm font-bold text-[#F5F1EB] mb-3">Minha conta</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/account/profile" className="hover:text-[#F5F1EB] transition-colors">
                  Meu perfil
                </Link>
              </li>
              <li>
                <Link to="/account/wallets" className="hover:text-[#F5F1EB] transition-colors">
                  Carteiras conectadas
                </Link>
              </li>
              <li>
                <Link to="/cart" className="hover:text-[#F5F1EB] transition-colors">
                  Carrinho e reservas
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-[#F5F1EB] transition-colors">
                  Entrar / Criar conta
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[#F5F1EB] mb-3">Ajuda e guia</h3>
            <ul className="space-y-2">
              <li>
                <a href="#diario-cunhagem" className="hover:text-[#F5F1EB] transition-colors">
                  Como comprar NFTs
                </a>
              </li>
              <li>
                <a href="#diario-cunhagem" className="hover:text-[#F5F1EB] transition-colors">
                  Taxas de rede (Gas)
                </a>
              </li>
              <li>
                <a href="#diario-cunhagem" className="hover:text-[#F5F1EB] transition-colors">
                  Segurança de carteiras
                </a>
              </li>
              <li>
                <a href="#diario-cunhagem" className="hover:text-[#F5F1EB] transition-colors">
                  Autenticidade on-chain
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[#F5F1EB] mb-3">Categorias</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/"
                  search={{ category: 'art' }}
                  className="hover:text-[#F5F1EB] transition-colors"
                >
                  Arte generativa & PFP
                </Link>
              </li>
              <li>
                <Link
                  to="/"
                  search={{ category: 'collectibles' }}
                  className="hover:text-[#F5F1EB] transition-colors"
                >
                  Colecionáveis 3D
                </Link>
              </li>
              <li>
                <Link
                  to="/"
                  search={{ category: 'photography' }}
                  className="hover:text-[#F5F1EB] transition-colors"
                >
                  Fotografia & Surrealismo
                </Link>
              </li>
              <li>
                <Link
                  to="/"
                  search={{ category: 'music' }}
                  className="hover:text-[#F5F1EB] transition-colors"
                >
                  Áudio & Sintetizadores
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#F5F1EB]">Redes suportadas</h3>
            <p className="text-xs text-[#CFB28C]">
              Transações verificadas em múltiplas redes com conversão automática.
            </p>
            <div className="inline-block px-3 py-2 rounded bg-[#140D0A] border border-[#3F2319] text-[#E89B55] font-bold text-xs">
              Aceitamos: ETH • MATIC • USDC • WETH
            </div>
          </div>
        </div>

        <div className="border-t border-[#3F2319] py-4 text-center text-xs text-[#B39463]">
          © 2021 Kurio. Todos os direitos reservados.
        </div>
      </footer>

      <nav
        aria-label="Navegação móvel inferior"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-[#241612]/95 backdrop-blur border-t border-[#3F2319] grid grid-cols-4 px-2"
      >
        <Link
          to="/"
          className={`flex flex-col items-center justify-center min-h-[44px] text-[11px] ${
            pathname === '/' ? 'text-[#E89B55] font-bold' : 'text-[#CFB28C]'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span>Início</span>
        </Link>
        <Link
          to="/"
          search={{ sort: 'recent' }}
          className={`flex flex-col items-center justify-center min-h-[44px] text-[11px] ${
            pathname.startsWith('/nfts') ? 'text-[#E89B55] font-bold' : 'text-[#CFB28C]'
          }`}
        >
          <Sparkles className="w-5 h-5 mb-0.5" />
          <span>Mercado</span>
        </Link>
        <Link
          to="/cart"
          className={`relative flex flex-col items-center justify-center min-h-[44px] text-[11px] ${
            pathname.startsWith('/cart') ? 'text-[#E89B55] font-bold' : 'text-[#CFB28C]'
          }`}
        >
          <ShoppingBag className="w-5 h-5 mb-0.5" />
          <span>Carrinho ({cartCount})</span>
        </Link>
        <Link
          to={session ? '/account/profile' : '/login'}
          className={`flex flex-col items-center justify-center min-h-[44px] text-[11px] ${
            pathname.startsWith('/account') || pathname === '/login'
              ? 'text-[#E89B55] font-bold'
              : 'text-[#CFB28C]'
          }`}
        >
          <UserIcon className="w-5 h-5 mb-0.5" />
          <span>{session ? 'Perfil' : 'Entrar'}</span>
        </Link>
      </nav>
    </div>
  )
}
