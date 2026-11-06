import { useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  Heart,
  Home,
  LogOut,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  User as UserIcon,
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

const FOOTER_HIGHLIGHTS = [
  {
    letter: 'W',
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    letter: 'C',
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    letter: 'D',
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
] as const

const FOOTER_COLUMNS = [
  {
    title: 'Meu perfil',
    items: ['Meu perfil', 'Minha coleção', 'Atividade', 'Estúdio do criador', 'Lista de interesse'],
  },
  {
    title: 'Central de ajuda',
    items: ['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'],
  },
  {
    title: 'Coleções',
    items: ['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade'],
  },
] as const

const SOCIAL_LINKS = [
  { label: 'Facebook', short: 'f' },
  { label: 'Instagram', short: 'ig' },
  { label: 'X (Twitter)', short: 'X' },
  { label: 'LinkedIn', short: 'in' },
  { label: 'YouTube', short: '▶' },
] as const

const COMPATIBLE_WALLETS = ['MetaMask', 'WalletConnect', 'Coinbase'] as const

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { session, expiredNotice } = useAuthSnapshot()
  const realtime = useRealtimeState()
  const { data: cart } = useCartQuery()
  const { data: favorites } = useFavoritesQuery()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')

  const cartCount =
    cart?.summary.itemCount ?? cart?.items.reduce((acc, item) => acc + item.quantity, 0) ?? 0
  const favCount = favorites?.nftIds.length ?? 0

  const pathname = location.pathname
  const isNftDetail = pathname.startsWith('/nfts')

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

  const scrollToSection = (id: string) => {
    if (pathname === '/') {
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
    navigate({ to: '/' }).then(() => {
      setTimeout(() => {
        const el = document.getElementById(id)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' })
        }
      }, 100)
    })
  }

  const handleInicioClick = (e: React.MouseEvent) => {
    if (pathname === '/') {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleMercadoClick = (e: React.MouseEvent) => {
    e.preventDefault()
    scrollToSection('catalogo-nfts')
  }

  const handleCriadoresClick = (e: React.MouseEvent) => {
    e.preventDefault()
    scrollToSection('criadores')
  }

  const handleAprendaClick = (e: React.MouseEvent) => {
    e.preventDefault()
    scrollToSection('diario-cunhagem')
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
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[#140D0A] text-[#F5F1EB] selection:bg-[#D28A4C] selection:text-[#140D0A]">
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
      <header className="sticky top-0 z-30 border-b border-[#3A251C]/60 bg-[#140D0A]">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="text-sm font-bold tracking-[0.3em] text-[#F5F1EB] uppercase transition-colors hover:text-[#E09550] focus-visible:outline-none"
          >
            KURIO
          </Link>

          <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-8">
            <Link
              to="/"
              onClick={handleInicioClick}
              className={`rounded-sm border-b-2 px-1 pb-1 text-xs font-bold tracking-wide transition-colors ${
                pathname === '/'
                  ? 'border-[#E09550] text-[#E09550]'
                  : 'border-transparent text-[#F5F1EB] hover:text-[#E09550]'
              }`}
            >
              Início
            </Link>
            <a
              href="/#catalogo-nfts"
              onClick={handleMercadoClick}
              className={`cursor-pointer rounded-sm border-b-2 px-1 pb-1 text-xs font-bold tracking-wide transition-colors ${
                isNftDetail
                  ? 'border-[#E09550] text-[#E09550]'
                  : 'border-transparent text-[#F5F1EB] hover:text-[#E09550]'
              }`}
            >
              Mercado
            </a>
            <a
              href="/#criadores"
              onClick={handleCriadoresClick}
              className="cursor-pointer rounded-sm border-b-2 border-transparent px-1 pb-1 text-xs font-bold tracking-wide text-[#F5F1EB] transition-colors hover:text-[#E09550]"
            >
              Criadores
            </a>
            <a
              href="/#diario-cunhagem"
              onClick={handleAprendaClick}
              className="cursor-pointer rounded-sm border-b-2 border-transparent px-1 pb-1 text-xs font-bold tracking-wide text-[#F5F1EB] transition-colors hover:text-[#E09550]"
            >
              Aprenda
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <span
              data-testid="realtime-status"
              data-status={realtime.status}
              role="status"
              className="sr-only"
            >
              {realtime.status === 'connected'
                ? 'Atualizações em tempo real conectadas'
                : 'Atualizações em tempo real reconectando'}
            </span>

            <button
              type="button"
              aria-label="Abrir busca rápida"
              onClick={() => setSearchOpen((v) => !v)}
              className="rounded-sm p-2 text-[#CFB28C] transition-colors hover:text-[#F5F1EB]"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>

            {session && (
              <Link
                to="/account/profile"
                aria-label={`Favoritos (${favCount})`}
                data-testid="header-favorites-link"
                className="relative hidden sm:flex items-center justify-center rounded-sm p-2 text-[#CFB28C] hover:text-[#F5F1EB] transition-colors"
              >
                <Heart className="w-[18px] h-[18px] text-[#E89B55]" />
                {favCount > 0 && (
                  <span
                    aria-hidden="true"
                    data-testid="header-favorites-badge"
                    className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#2F1D15] border border-[#D28A4C] text-[#E89B55] text-[10px] font-bold flex items-center justify-center"
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
              className="relative rounded-sm p-2 text-[#CFB28C] transition-colors hover:text-[#E09550]"
            >
              <ShoppingCart className="w-[18px] h-[18px]" strokeWidth={1.8} />
              <span
                aria-hidden="true"
                data-testid="header-cart-badge"
                className={
                  cartCount > 0
                    ? 'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D28A4C] px-1 text-[10px] font-bold leading-none text-[#140D0A]'
                    : 'sr-only'
                }
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
                className="inline-flex h-9 items-center justify-center rounded-md bg-[#D28A4C] px-5 text-[11px] font-bold uppercase tracking-wide text-[#140D0A] transition-colors hover:bg-[#E09550]"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>

        {searchOpen && (
          <div className="border-t border-[#3A251C]/60 bg-[#241612] px-4 py-3">
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

      <footer className="bg-[#140D0A] pb-24 md:pb-0">
        <div className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-14 md:px-6">
          <div className="overflow-hidden rounded-2xl bg-[#241612]">
            {/* Tier 1: Medallions + Newsletter */}
            <div className="grid gap-10 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-[#3A251C]/60 lg:px-8">
              {FOOTER_HIGHLIGHTS.map((item) => (
                <section
                  key={item.title}
                  className="lg:px-7 lg:first:pl-2 lg:last:pr-2"
                >
                  <div
                    aria-hidden="true"
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D28A4C] text-xl font-bold text-[#140D0A]"
                  >
                    {item.letter}
                  </div>
                  <h3 className="mt-5 text-base font-bold text-[#F5F1EB]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#CFB28C]">{item.text}</p>
                </section>
              ))}

              <section aria-label="Receba novidades da Kurio" className="lg:px-7">
                <h3 className="text-base font-bold leading-snug text-[#F5F1EB]">
                  Antecipe-se ao próximo lançamento
                </h3>
                <form
                  className="mt-4 flex"
                  onSubmit={(e) => {
                    e.preventDefault()
                    toast.success('Inscrição confirmada na newsletter da Kurio!')
                  }}
                >
                  <label htmlFor="newsletter-email" className="sr-only">
                    Digite seu e-mail
                  </label>
                  <input
                    id="newsletter-email"
                    name="email"
                    type="email"
                    required
                    placeholder="digite seu e-mail..."
                    className="h-11 w-full min-w-0 rounded-l-md bg-[#38220F] px-2.5 text-xs text-[#F5F1EB] placeholder:text-[10px] placeholder:text-[#CFB28C]/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#E09550]"
                  />
                  <button
                    type="submit"
                    className="h-11 shrink-0 rounded-r-md bg-[#D28A4C] px-3.5 text-xs font-bold text-[#140D0A] transition-colors hover:bg-[#E09550]"
                  >
                    Enviar
                  </button>
                </form>
                <p className="mt-4 text-sm leading-relaxed text-[#CFB28C]">
                  Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
                </p>
              </section>
            </div>

            {/* Tier 2: Brand Band */}
            <div className="grid items-center gap-4 bg-[#38220F] px-6 py-6 text-sm text-[#F5F1EB] sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
              <span className="text-sm font-bold tracking-[0.3em] text-[#F5F1EB]">KURIO</span>
              <p>
                Feito para colecionadores,
                <br className="hidden lg:block" /> criadores e cultura
              </p>
              <p>contato@email.com</p>
              <p className="lg:text-right">+55 11 4002 8922</p>
            </div>

            {/* Tier 3: Directory Links & Socials */}
            <div className="grid gap-10 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
              {FOOTER_COLUMNS.map((col) => (
                <section key={col.title}>
                  <h3 className="text-lg font-bold text-[#F5F1EB]">{col.title}</h3>
                  <ul className="mt-4 space-y-3">
                    {col.items.map((item) => (
                      <li
                        key={item}
                        aria-disabled="true"
                        className="cursor-default text-sm text-[#F5F1EB]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              <section>
                <h3 className="text-lg font-bold text-[#F5F1EB]">Redes sociais</h3>
                <div className="mt-4 flex gap-2">
                  {SOCIAL_LINKS.map((s) => (
                    <span
                      key={s.label}
                      role="img"
                      aria-label={s.label}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-[#D28A4C]/70 text-xs font-bold text-[#D28A4C]"
                    >
                      {s.short}
                    </span>
                  ))}
                </div>
                <h3 className="mt-8 text-lg font-bold text-[#F5F1EB]">Carteiras compatíveis</h3>
                <div className="mt-3 flex items-center justify-center gap-1.5 overflow-x-auto whitespace-nowrap rounded-md border border-[#D28A4C]/40 bg-[#38220F] px-2 py-2.5">
                  {COMPATIBLE_WALLETS.map((w, idx) => (
                    <span key={w} className="inline-flex items-center gap-1.5">
                      {idx > 0 && (
                        <span aria-hidden="true" className="text-[10px] text-[#D28A4C]/80">
                          •
                        </span>
                      )}
                      <span className="text-[10px] font-bold uppercase text-[#D28A4C]">{w}</span>
                    </span>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-[#F5F1EB]">
            © 2026 Kurio. Propriedade digital para todos.
          </p>
        </div>
      </footer>

      <nav
        aria-label="Navegação móvel inferior"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-[#241612]/95 backdrop-blur border-t border-[#3F2319] grid grid-cols-4 px-2"
      >
        <Link
          to="/"
          onClick={handleInicioClick}
          className={`flex flex-col items-center justify-center min-h-[44px] text-[11px] ${
            pathname === '/' ? 'text-[#E89B55] font-bold' : 'text-[#CFB28C]'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span>Início</span>
        </Link>
        <a
          href="/#catalogo-nfts"
          onClick={handleMercadoClick}
          className={`flex flex-col items-center justify-center min-h-[44px] text-[11px] cursor-pointer ${
            pathname.startsWith('/nfts') ? 'text-[#E89B55] font-bold' : 'text-[#CFB28C]'
          }`}
        >
          <Sparkles className="w-5 h-5 mb-0.5" />
          <span>Mercado</span>
        </a>
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
