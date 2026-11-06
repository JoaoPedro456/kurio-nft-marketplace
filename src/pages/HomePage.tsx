import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  Filter,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import type {
  Availability,
  Network,
  NftCategory,
  NftListQuery,
  NftSort,
} from '@/lib/api/contracts'
import { useNftsQuery } from '@/lib/hooks'
import { NftCard } from '@/components/NftCard'
import { NftCardSkeleton } from '@/components/NftCardSkeleton'
import type { HomeSearch } from '@/router'

const COLLECTIONS: { value: NftCategory | 'all'; label: string; sublabel: string }[] = [
  { value: 'all', label: 'Todas as coleções', sublabel: '36' },
  { value: 'art', label: 'Kurio Apes (Arte)', sublabel: '6' },
  { value: 'collectibles', label: 'Nomad Genesis (Colecionáveis)', sublabel: '6' },
  { value: 'gaming', label: 'Cyber Vessels (Gaming)', sublabel: '6' },
  { value: 'photography', label: 'Flora & Surreal (Fotografia)', sublabel: '6' },
  { value: 'music', label: 'Synth Audio (Música)', sublabel: '6' },
  { value: 'sports', label: 'Baron Pass (Esportes & Utilidade)', sublabel: '6' },
]

const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
  { value: 'all', label: 'Todos os status' },
  { value: 'available', label: 'Disponíveis agora' },
  { value: 'sold-out', label: 'Esgotados' },
]

const NETWORKS: { value: Network | 'all'; label: string; count: number }[] = [
  { value: 'all', label: 'Todas as redes', count: 36 },
  { value: 'ethereum', label: 'Ethereum', count: 16 },
  { value: 'polygon', label: 'Polygon', count: 10 },
  { value: 'arbitrum', label: 'Arbitrum', count: 10 },
]

const BLOG_POSTS = [
  {
    id: 'blog-1',
    meta: '12 de setembro  |  Leitura de 6 min',
    title: 'Os colecionáveis digitais que estão definindo a temporada',
    excerpt: 'Converse com artistas generativos e descubra como avaliar raridade on-chain.',
    image: '/images/nfts/nft-13.png',
  },
  {
    id: 'blog-2',
    meta: '15 de setembro  |  Leitura de 2 min',
    title: 'Por que edições 1/1 e passes utilitários valorizam no longo prazo',
    excerpt: 'Entenda a diferença entre edições abertas, séries limitadas e obras únicas.',
    image: '/images/nfts/nft-14.png',
  },
  {
    id: 'blog-3',
    meta: '15 de setembro  |  Leitura de 3 min',
    title: 'Guia de custódia segura: MetaMask, hardware wallets e ENS',
    excerpt: 'Boas práticas essenciais para assinar transações e proteger sua coleção.',
    image: '/images/nfts/nft-15.png',
  },
  {
    id: 'blog-4',
    meta: '18 de setembro  |  Leitura de 5 min',
    title: 'Como funcionam as cotações de rede e taxas de gás na Kurio',
    excerpt: 'Transparência total em cada etapa do checkout com proteção de preço.',
    image: '/images/nfts/nft-16.png',
  },
]

export function HomePage() {
  const search = useSearch({ strict: false }) as HomeSearch
  const navigate = useNavigate()

  const [searchInput, setSearchInput] = useState(search.q ?? '')
  const [minPriceInput, setMinPriceInput] = useState(search.minPrice ?? '')
  const [maxPriceInput, setMaxPriceInput] = useState(search.maxPrice ?? '')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [heroSlide, setHeroSlide] = useState(0)

  useEffect(() => {
    const handleHashScroll = () => {
      const hash = window.location.hash
      if (hash) {
        const id = hash.replace('#', '')
        const el = document.getElementById(id)
        if (el) {
          setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth' })
          }, 100)
        }
      }
    }

    handleHashScroll()
    window.addEventListener('hashchange', handleHashScroll)
    return () => window.removeEventListener('hashchange', handleHashScroll)
  }, [])

  useEffect(() => {
    setSearchInput(search.q ?? '')
    setMinPriceInput(search.minPrice ?? '')
    setMaxPriceInput(search.maxPrice ?? '')
  }, [search.q, search.minPrice, search.maxPrice])


  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = searchInput.trim()
      const currentQ = search.q ?? ''
      if (trimmed !== currentQ) {
        navigate({
          to: '/',
          search: (prev) => ({
            ...prev,
            q: trimmed || undefined,
            page: 1,
          }),
          replace: true,
        })
      }
    }, 260)
    return () => window.clearTimeout(timer)
  }, [searchInput, search.q, navigate])

  const activeCategory = (search.category as NftCategory | undefined) ?? undefined
  const activeNetwork = (search.network as Network | undefined) ?? undefined
  const activeAvailability = (search.availability as Availability | undefined) ?? 'all'
  const activeSort = (search.sort as NftSort | undefined) ?? 'recent'

  const queryParams: NftListQuery = {
    q: search.q || undefined,
    category: activeCategory ? [activeCategory] : undefined,
    network: activeNetwork ? [activeNetwork] : undefined,
    availability: activeAvailability,
    minPrice: search.minPrice || undefined,
    maxPrice: search.maxPrice || undefined,
    sort: activeSort,
    page: search.page ?? 1,
    pageSize: 9,
  }

  const { data, isLoading, isError, error, refetch, isFetching } = useNftsQuery(queryParams)

  const updateFilter = (patch: Partial<HomeSearch>) => {
    navigate({
      to: '/',
      search: (prev) => {
        const next: HomeSearch = { ...prev, ...patch, page: patch.page ?? 1 }
        if (!next.category || next.category === 'all') delete next.category
        if (!next.network || next.network === 'all') delete next.network
        if (!next.availability || next.availability === 'all') delete next.availability
        if (!next.q) delete next.q
        if (!next.minPrice) delete next.minPrice
        if (!next.maxPrice) delete next.maxPrice
        return next
      },
    })
  }

  const handleApplyPriceRange = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilter({
      minPrice: minPriceInput.trim() || undefined,
      maxPrice: maxPriceInput.trim() || undefined,
      page: 1,
    })
    setMobileFiltersOpen(false)
  }

  const handleClearFilters = () => {
    setSearchInput('')
    setMinPriceInput('')
    setMaxPriceInput('')
    navigate({ to: '/', search: {} })
    setMobileFiltersOpen(false)
  }

  const hasActiveFilters = Boolean(
    search.q ||
      search.category ||
      search.network ||
      (search.availability && search.availability !== 'all') ||
      search.minPrice ||
      search.maxPrice,
  )

  const sidebarContent = (
    <div className="bg-[#241612] border border-[#3F2319] rounded-[6px] p-5 space-y-7">
      {/* Collections / Categories */}
      <div>
        <h2 className="text-lg font-bold text-[#F5F1EB] mb-3">Coleções</h2>
        <ul className="space-y-1">
          {COLLECTIONS.map((col) => {
            const active = (search.category ?? 'all') === col.value
            return (
              <li key={col.value}>
                <button
                  type="button"
                  data-testid={`filter-category-${col.value}`}
                  onClick={() => {
                    updateFilter({ category: col.value === 'all' ? undefined : col.value })
                    setMobileFiltersOpen(false)
                  }}
                  className={`w-full flex items-center justify-between py-2 px-2.5 rounded text-left text-sm transition-colors ${
                    active
                      ? 'bg-[#2F1D15] text-[#E89B55] font-bold'
                      : 'text-[#F5F1EB] hover:text-[#E89B55]'
                  }`}
                >
                  <span>{col.label}</span>
                  <span className={active ? 'text-[#E89B55]' : 'text-[#CFB28C]'}>
                    ({col.sublabel})
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Price Range */}
      <form onSubmit={handleApplyPriceRange} className="space-y-3 border-t border-[#3F2319] pt-5">
        <h2 className="text-lg font-bold text-[#F5F1EB]">Faixa de preço</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="min-price-input" className="block text-xs text-[#CFB28C] mb-1">
              Mín (ETH)
            </label>
            <input
              id="min-price-input"
              data-testid="filter-min-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.02"
              value={minPriceInput}
              onChange={(e) => setMinPriceInput(e.target.value)}
              className="w-full h-9 px-2.5 rounded bg-[#140D0A] border border-[#3F2319] text-xs text-[#F5F1EB] placeholder-[#B39463] focus:border-[#D28A4C] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="max-price-input" className="block text-xs text-[#CFB28C] mb-1">
              Máx (ETH)
            </label>
            <input
              id="max-price-input"
              data-testid="filter-max-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="12.30"
              value={maxPriceInput}
              onChange={(e) => setMaxPriceInput(e.target.value)}
              className="w-full h-9 px-2.5 rounded bg-[#140D0A] border border-[#3F2319] text-xs text-[#F5F1EB] placeholder-[#B39463] focus:border-[#D28A4C] focus:outline-none"
            />
          </div>
        </div>
        <div className="text-xs text-[#CFB28C]">
          Preço:{' '}
          <strong className="text-[#E89B55]">
            {minPriceInput || '0,02'} - {maxPriceInput || '12,30'} ETH
          </strong>
        </div>
        <button
          type="submit"
          data-testid="filter-apply-price"
          className="h-9 px-5 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-xs uppercase transition-colors"
        >
          Aplicar
        </button>
      </form>

      {/* Availability */}
      <div className="border-t border-[#3F2319] pt-5">
        <h2 className="text-lg font-bold text-[#F5F1EB] mb-3">Disponibilidade</h2>
        <div className="space-y-1.5">
          {AVAILABILITY_OPTIONS.map((opt) => {
            const active = activeAvailability === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                data-testid={`filter-availability-${opt.value}`}
                onClick={() => {
                  updateFilter({ availability: opt.value === 'all' ? undefined : opt.value })
                  setMobileFiltersOpen(false)
                }}
                className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded text-xs transition-colors ${
                  active
                    ? 'bg-[#2F1D15] text-[#E89B55] font-bold'
                    : 'text-[#CFB28C] hover:text-[#F5F1EB]'
                }`}
              >
                <span>{opt.label}</span>
                {active && <span className="w-2 h-2 rounded-full bg-[#D28A4C]" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Network */}
      <div className="border-t border-[#3F2319] pt-5">
        <h2 className="text-lg font-bold text-[#F5F1EB] mb-3">Rede</h2>
        <ul className="space-y-1">
          {NETWORKS.map((net) => {
            const active = (search.network ?? 'all') === net.value
            return (
              <li key={net.value}>
                <button
                  type="button"
                  data-testid={`filter-network-${net.value}`}
                  onClick={() => {
                    updateFilter({ network: net.value === 'all' ? undefined : net.value })
                    setMobileFiltersOpen(false)
                  }}
                  className={`w-full flex items-center justify-between py-2 px-2.5 rounded text-sm transition-colors ${
                    active
                      ? 'bg-[#2F1D15] text-[#E89B55] font-bold'
                      : 'text-[#F5F1EB] hover:text-[#E89B55]'
                  }`}
                >
                  <span>{net.label}</span>
                  <span className="text-xs text-[#CFB28C]">({net.count})</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClearFilters}
          data-testid="clear-filters-btn"
          className="w-full h-10 rounded-[6px] border border-[#D28A4C] text-[#E89B55] hover:bg-[#D28A4C] hover:text-[#140D0A] font-bold text-xs uppercase transition-colors"
        >
          Limpar filtros
        </button>
      )}
    </div>
  )

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-4 space-y-14">
      <section
        aria-label="Destaque principal Kurio"
        className="relative rounded-[8px] bg-[#241612] border border-[#3F2319] overflow-hidden px-6 py-8 md:px-10 md:py-10"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-xs sm:text-sm font-medium tracking-[1.4px] uppercase text-[#F5F1EB]">
              Bem-vindo à Kurio
            </p>
            <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-bold uppercase leading-[1.08] text-[#F5F1EB]">
              SEJA DONO DO FUTURO DA{' '}
              <span className="text-[#E89B55]">ARTE DIGITAL</span>
            </h1>
            <p className="text-xs sm:text-sm leading-6 text-[#CFB28C] max-w-[540px]">
              Somos um marketplace Web3 dedicado a arte digital rara, colecionáveis verificados e
              lançamentos exclusivos de criadores. Explore as coleções em destaque e conecte sua
              carteira para começar a colecionar.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <a
                href="#catalogo-nfts"
                className="h-10 px-6 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-sm uppercase inline-flex items-center justify-center transition-colors"
              >
                EXPLORAR
              </a>
              <Link
                to="/nfts/$nftId"
                params={{ nftId: 'nft-1' }}
                className="h-10 px-5 rounded-[6px] border border-[#55321F] hover:border-[#D28A4C] text-[#F5F1EB] text-xs font-bold uppercase inline-flex items-center gap-2 transition-colors"
              >
                <span>Ver Emerald Ape #042</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#E89B55]" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <Link
              to="/nfts/$nftId"
              params={{ nftId: 'nft-1' }}
              className="relative w-full max-w-[340px] sm:max-w-[420px] aspect-square rounded-[8px] overflow-hidden border border-[#3F2319] bg-[#140D0A] shadow-xl group"
            >
              <img
                src="/images/nfts/nft-1.png"
                alt="Emerald Ape #042 em destaque na Kurio"
                width={450}
                height={450}
                fetchPriority="high"
                decoding="sync"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute bottom-3 left-3 right-3 p-3 rounded-[6px] bg-[#140D0A]/90 backdrop-blur-sm border border-[#3F2319] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#F5F1EB]">Emerald Ape #042</p>
                  <p className="text-[11px] text-[#CFB28C]">Kurio Apes • Edição 1/50</p>
                </div>
                <span className="text-sm font-bold text-[#E89B55]">1.19 ETH</span>
              </div>
            </Link>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          {[0, 1, 2].map((idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Slide ${idx + 1}`}
              onClick={() => setHeroSlide(idx)}
              className="w-6 h-6 flex items-center justify-center rounded-full"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  heroSlide === idx ? 'bg-[#D28A4C]' : 'bg-[#D28A4C]/30'
                }`}
              />
            </button>
          ))}
        </div>
      </section>

      <section
        id="catalogo-nfts"
        aria-label="Catálogo de NFTs"
        className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        <aside className="hidden lg:block lg:col-span-3 space-y-6">
          {sidebarContent}

          <div className="rounded-[6px] bg-[#241612] border border-[#3F2319] overflow-hidden p-5 text-center space-y-3">
            <p className="text-xs tracking-wider uppercase text-[#CFB28C]">NFT EM DESTAQUE</p>
            <p className="text-xl font-bold text-[#E89B55]">OFERTA LIMITADA</p>
            <Link
              to="/nfts/$nftId"
              params={{ nftId: 'nft-3' }}
              className="block rounded-[6px] overflow-hidden border border-[#3F2319] mt-2"
            >
              <img
                src="/images/nfts/nft-10.png"
                alt="Oferta limitada Kurio"
                width={270}
                height={270}
                loading="lazy"
                className="w-full aspect-square object-cover hover:scale-105 transition-transform"
              />
            </Link>
          </div>
        </aside>

        <div className="lg:col-span-9 space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-[#B39463] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  data-testid="catalog-search-input"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Pesquisar NFT por nome, descrição ou criador..."
                  aria-label="Pesquisar NFTs no catálogo"
                  className="w-full h-10 pl-10 pr-9 rounded-[6px] bg-[#241612] border border-[#3F2319] text-xs sm:text-sm text-[#F5F1EB] placeholder-[#B39463] focus:border-[#D28A4C] focus:outline-none"
                />
                {searchInput && (
                  <button
                    type="button"
                    aria-label="Limpar busca"
                    onClick={() => setSearchInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#CFB28C] hover:text-[#F5F1EB]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                data-testid="mobile-filters-trigger"
                className="lg:hidden h-10 px-4 rounded-[6px] bg-[#241612] border border-[#3F2319] text-xs font-bold text-[#F5F1EB] inline-flex items-center gap-2"
              >
                <Filter className="w-4 h-4 text-[#E89B55]" />
                <span>Filtros</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#3F2319] pb-3">
              <div className="flex items-center gap-6 overflow-x-auto">
                <button
                  type="button"
                  data-testid="tab-all-nfts"
                  onClick={() => updateFilter({ sort: 'recent', availability: undefined })}
                  className={`relative pb-2 text-sm whitespace-nowrap transition-colors ${
                    activeSort === 'recent' && activeAvailability === 'all'
                      ? 'text-[#E89B55] font-bold after:absolute after:bottom-[-13px] after:left-0 after:right-0 after:h-[2px] after:bg-[#D28A4C]'
                      : 'text-[#F5F1EB] hover:text-[#E89B55]'
                  }`}
                >
                  Todos os NFTs
                </button>
                <button
                  type="button"
                  data-testid="tab-available-nfts"
                  onClick={() => updateFilter({ availability: 'available' })}
                  className={`relative pb-2 text-sm whitespace-nowrap transition-colors ${
                    activeAvailability === 'available'
                      ? 'text-[#E89B55] font-bold after:absolute after:bottom-[-13px] after:left-0 after:right-0 after:h-[2px] after:bg-[#D28A4C]'
                      : 'text-[#F5F1EB] hover:text-[#E89B55]'
                  }`}
                >
                  Novos lançamentos
                </button>
                <button
                  type="button"
                  data-testid="tab-popular-nfts"
                  onClick={() => updateFilter({ sort: 'popular', availability: undefined })}
                  className={`relative pb-2 text-sm whitespace-nowrap transition-colors ${
                    activeSort === 'popular'
                      ? 'text-[#E89B55] font-bold after:absolute after:bottom-[-13px] after:left-0 after:right-0 after:h-[2px] after:bg-[#D28A4C]'
                      : 'text-[#F5F1EB] hover:text-[#E89B55]'
                  }`}
                >
                  Em alta
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <SlidersHorizontal className="w-4 h-4 text-[#CFB28C] hidden sm:inline" />
                <label htmlFor="catalog-sort-select" className="text-[#CFB28C]">
                  Ordenar por:
                </label>
                <select
                  id="catalog-sort-select"
                  data-testid="catalog-sort-select"
                  value={activeSort}
                  onChange={(e) => updateFilter({ sort: e.target.value as NftSort })}
                  className="h-9 px-2.5 rounded bg-[#241612] border border-[#3F2319] text-xs sm:text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
                >
                  <option value="recent">Listados recentemente</option>
                  <option value="popular">Mais populares</option>
                  <option value="price-asc">Menor preço (ETH)</option>
                  <option value="price-desc">Maior preço (ETH)</option>
                </select>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div
              data-testid="catalog-loading-grid"
              className="grid grid-cols-2 md:grid-cols-3 gap-5 sm:gap-7"
            >
              {Array.from({ length: 9 }).map((_, idx) => (
                <NftCardSkeleton key={idx} />
              ))}
            </div>
          ) : isError ? (
            <div
              role="alert"
              data-testid="catalog-error-state"
              className="rounded-[6px] bg-[#241612] border border-[#F0805F]/50 p-8 text-center space-y-4"
            >
              <AlertCircle className="w-10 h-10 text-[#F0805F] mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#F5F1EB]">
                  Falha ao carregar o catálogo de NFTs
                </h3>
                <p className="text-xs text-[#CFB28C]">
                  {error instanceof Error
                    ? error.message
                    : 'Ocorreu um erro temporário na comunicação com o servidor.'}
                </p>
              </div>
              <button
                type="button"
                data-testid="catalog-retry-btn"
                onClick={() => refetch()}
                className="h-10 px-5 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-xs uppercase inline-flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tentar novamente</span>
              </button>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div
              data-testid="catalog-empty-state"
              className="rounded-[6px] bg-[#241612] border border-[#3F2319] p-10 text-center space-y-4"
            >
              <p className="text-base font-bold text-[#F5F1EB]">
                Nenhum NFT encontrado com os filtros selecionados
              </p>
              <p className="text-xs text-[#CFB28C] max-w-md mx-auto">
                Tente ajustar o termo de busca, ampliar a faixa de preço em ETH ou limpar os filtros
                ativos.
              </p>
              <button
                type="button"
                data-testid="empty-clear-filters-btn"
                onClick={handleClearFilters}
                className="h-10 px-5 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-xs uppercase transition-colors"
              >
                Limpar todos os filtros
              </button>
            </div>
          ) : (
            <>
              <div
                data-testid="catalog-grid"
                className={`grid grid-cols-2 md:grid-cols-3 gap-5 sm:gap-7 transition-opacity ${
                  isFetching ? 'opacity-80' : 'opacity-100'
                }`}
              >
                {data.items.map((nft) => (
                  <NftCard key={nft.id} nft={nft} priority={false} />
                ))}
              </div>

              {data.totalPages > 1 && (
                <nav
                  aria-label="Paginação do catálogo"
                  data-testid="catalog-pagination"
                  className="pt-4 flex items-center justify-between flex-wrap gap-4"
                >
                  <span className="text-xs text-[#CFB28C]">
                    Exibindo página <strong className="text-[#F5F1EB]">{data.page}</strong> de{' '}
                    <strong className="text-[#F5F1EB]">{data.totalPages}</strong> ({data.total} NFTs)
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    {Array.from({ length: data.totalPages }).map((_, idx) => {
                      const pageNumber = idx + 1
                      const isCurrent = pageNumber === data.page
                      return (
                        <button
                          key={pageNumber}
                          type="button"
                          data-testid={`pagination-page-${pageNumber}`}
                          aria-current={isCurrent ? 'page' : undefined}
                          onClick={() => updateFilter({ page: pageNumber })}
                          className={`w-[35px] h-[35px] rounded-[4px] text-sm flex items-center justify-center transition-colors ${
                            isCurrent
                              ? 'bg-[#D28A4C] text-[#140D0A] font-bold'
                              : 'bg-transparent border border-[#3F2319] text-[#F5F1EB] hover:border-[#D28A4C]'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      )
                    })}
                    {data.page < data.totalPages && (
                      <button
                        type="button"
                        data-testid="pagination-next"
                        aria-label="Próxima página"
                        onClick={() => updateFilter({ page: data.page + 1 })}
                        className="w-[35px] h-[35px] rounded-[4px] border border-[#3F2319] text-[#F5F1EB] hover:border-[#D28A4C] flex items-center justify-center transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </nav>
              )}
            </>
          )}
        </div>
      </section>

      {mobileFiltersOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filtros do catálogo"
          className="fixed inset-0 z-50 lg:hidden flex"
        >
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="relative z-10 w-full max-w-[320px] bg-[#140D0A] h-full overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#3F2319]">
              <span className="font-bold text-sm text-[#F5F1EB]">Filtrar NFTs</span>
              <button
                type="button"
                aria-label="Fechar filtros"
                onClick={() => setMobileFiltersOpen(false)}
                className="p-2 text-[#CFB28C] hover:text-[#F5F1EB]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      <section id="criadores" aria-label="Coleções em destaque" className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-2 gap-7">
        <div className="h-[250px] relative rounded-[8px] bg-[#241612] border border-[#3F2319] overflow-hidden p-6 flex flex-col justify-between">
          <img
            src="/images/nfts/nft-2.png"
            alt="Lançamentos gênesis de edição limitada"
            width={280}
            height={250}
            loading="lazy"
            className="w-[240px] sm:w-[280px] h-[250px] rounded-l-[8px] object-cover absolute left-0 top-0 border-r border-[#3F2319]"
          />
          <div className="ml-auto w-[240px] sm:w-[260px] text-right flex flex-col justify-between h-full relative z-10">
            <div>
              <h2 className="font-bold text-[18px] text-[#F5F1EB] leading-[24px]">
                Lançamentos gênesis<br />de edição limitada
              </h2>
              <p className="font-normal text-[14px] text-[#CFB28C] leading-[24px] mt-2">
                Colecione edições escassas diretamente dos criadores antes da revelação pública.
              </p>
            </div>
            <Link
              to="/nfts/$nftId"
              params={{ nftId: 'nft-2' }}
              className="h-[40px] px-6 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-medium text-[14px] ml-auto inline-flex items-center gap-2 transition-colors"
            >
              <span>Explorar</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="h-[250px] relative rounded-[8px] bg-[#241612] border border-[#3F2319] overflow-hidden p-6 flex flex-col justify-between">
          <img
            src="/images/nfts/nft-5.png"
            alt="Arte digital selecionada e muito mais"
            width={280}
            height={250}
            loading="lazy"
            className="w-[240px] sm:w-[280px] h-[250px] rounded-l-[8px] object-cover absolute left-0 top-0 border-r border-[#3F2319]"
          />
          <div className="ml-auto w-[240px] sm:w-[260px] text-right flex flex-col justify-between h-full relative z-10">
            <div>
              <h2 className="font-bold text-[18px] text-[#F5F1EB] leading-[24px]">
                Arte digital selecionada<br />e muito mais
              </h2>
              <p className="font-normal text-[14px] text-[#CFB28C] leading-[24px] mt-2">
                Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.
              </p>
            </div>
            <Link
              to="/nfts/$nftId"
              params={{ nftId: 'nft-5' }}
              className="h-[40px] px-6 rounded-[6px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-medium text-[14px] ml-auto inline-flex items-center gap-2 transition-colors"
            >
              <span>Explorar</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Figma Pixel-Accurate Diário da Cunhagem */}
      <section id="diario-cunhagem" aria-label="Diário da Cunhagem" className="scroll-mt-24 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="font-bold text-[28px] text-[#F7F3EC]">Diário da Cunhagem</h2>
          <p className="font-normal text-[14px] text-[#CFB28C] max-w-xl mx-auto">
            Fique por dentro de lançamentos de criadores, movimentos de colecionadores e novidades
            do ecossistema Web3.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {BLOG_POSTS.map((post) => (
            <article
              key={post.id}
              className="rounded-[6px] bg-[#241612] border border-[#3F2319] overflow-hidden flex flex-col"
            >
              <img
                src={post.image}
                alt={post.title}
                width={268}
                height={195}
                loading="lazy"
                className="w-full h-[185px] object-cover border-b border-[#3F2319]"
              />
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-[#E89B55]">{post.meta}</p>
                  <h3 className="text-base font-bold text-[#F5F1EB] leading-6">{post.title}</h3>
                  <p className="text-xs text-[#CFB28C] leading-5">{post.excerpt}</p>
                </div>
                <Link
                  to="/nfts/$nftId"
                  params={{ nftId: 'nft-1' }}
                  className="text-xs font-medium text-[#F5F1EB] hover:text-[#E89B55] inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>Ler mais</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
