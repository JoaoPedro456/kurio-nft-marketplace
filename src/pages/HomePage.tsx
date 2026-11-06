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
    id: 'article-1',
    date: '12 de outubro',
    readingTime: 'Leitura de 4 min',
    title: 'Como funciona a propriedade de NFTs',
    excerpt: 'Entenda o que significa possuir um ativo digital.',
    image: '/assets/nft/nft-artwork-08.png',
  },
  {
    id: 'article-2',
    date: '13 de setembro',
    readingTime: 'Leitura de 6 min',
    title: '10 artistas digitais para acompanhar',
    excerpt: 'Conheça as mentores que moldam a cultura digital.',
    image: '/assets/nft/nft-artwork-03.png',
  },
  {
    id: 'article-3',
    date: '15 de setembro',
    readingTime: 'Leitura de 5 min',
    title: 'Raridade, utilidade e procedência',
    excerpt: 'O que observar nos atributos antes de colecionar.',
    image: '/assets/nft/nft-artwork-07.png',
  },
  {
    id: 'article-4',
    date: '17 de outubro',
    readingTime: 'Leitura de 7 min',
    title: 'Como proteger sua carteira',
    excerpt: 'Práticas essenciais para manter ativos e identidade.',
    image: '/assets/nft/nft-artwork-10.png',
  },
]

export function HomePage() {
  const search = useSearch({ strict: false }) as HomeSearch
  const navigate = useNavigate()

  const [searchInput, setSearchInput] = useState(search.q ?? '')
  const [minPriceInput, setMinPriceInput] = useState(search.minPrice ?? '')
  const [maxPriceInput, setMaxPriceInput] = useState(search.maxPrice ?? '')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

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
    <div className="space-y-6">
      {/* Category Filter */}
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
                  className={`w-full flex items-center justify-between py-2 px-2.5 rounded text-sm transition-colors ${
                    active
                      ? 'bg-[#2F1D15] text-[#E09550] font-bold'
                      : 'text-[#F5F1EB] hover:text-[#E09550]'
                  }`}
                >
                  <span>{col.label}</span>
                  <span className="text-xs text-[#CFB28C]">({col.sublabel})</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Price Range Filter */}
      <div className="border-t border-[#3F2319] pt-5">
        <h2 className="text-lg font-bold text-[#F5F1EB] mb-3">Faixa de preço</h2>
        <form onSubmit={handleApplyPriceRange} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="price-min" className="block text-xs text-[#CFB28C] mb-1">
                Mínimo (ETH)
              </label>
              <input
                id="price-min"
                data-testid="filter-price-min"
                type="number"
                step="0.01"
                min="0"
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                placeholder="0.00"
                className="w-full h-9 px-2.5 rounded bg-[#140D0A] border border-[#3F2319] text-xs text-[#F5F1EB] placeholder-[#CFB28C]/60 focus:border-[#D28A4C] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="price-max" className="block text-xs text-[#CFB28C] mb-1">
                Máximo (ETH)
              </label>
              <input
                id="price-max"
                data-testid="filter-price-max"
                type="number"
                step="0.01"
                min="0"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                placeholder="10.00"
                className="w-full h-9 px-2.5 rounded bg-[#140D0A] border border-[#3F2319] text-xs text-[#F5F1EB] placeholder-[#CFB28C]/60 focus:border-[#D28A4C] focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            data-testid="filter-price-apply"
            className="w-full h-8 rounded bg-[#2F1D15] hover:bg-[#D28A4C] hover:text-[#140D0A] text-xs font-bold text-[#E09550] transition-colors"
          >
            Aplicar
          </button>
        </form>
      </div>

      {/* Availability Filter */}
      <div className="border-t border-[#3F2319] pt-5">
        <h2 className="text-lg font-bold text-[#F5F1EB] mb-3">Disponibilidade</h2>
        <div className="space-y-1">
          {AVAILABILITY_OPTIONS.map((opt) => {
            const active = (search.availability ?? 'all') === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                data-testid={`filter-avail-${opt.value}`}
                onClick={() => {
                  updateFilter({ availability: opt.value === 'all' ? undefined : opt.value })
                  setMobileFiltersOpen(false)
                }}
                className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded text-xs transition-colors ${
                  active
                    ? 'bg-[#2F1D15] text-[#E09550] font-bold'
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
                      ? 'bg-[#2F1D15] text-[#E09550] font-bold'
                      : 'text-[#F5F1EB] hover:text-[#E09550]'
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
          className="w-full h-10 rounded-[6px] border border-[#D28A4C] text-[#E09550] hover:bg-[#D28A4C] hover:text-[#140D0A] font-bold text-xs uppercase transition-colors"
        >
          Limpar filtros
        </button>
      )}
    </div>
  )

  return (
    <div className="space-y-16 lg:space-y-24">
      {/* Hero Section */}
      <section
        aria-label="Apresentação da Kurio"
        className="mx-auto w-full max-w-[1200px] px-4 pt-6 md:px-6 md:pt-16"
      >
        {/* Mobile presentation card */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#5C341C] via-[#241612] to-[#140D0A] md:hidden">
          <div className="flex items-start justify-between gap-4 p-5">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#F5F1EB]/80">Bem-vindo à Kurio</p>
              <h1 className="mt-2 text-xl font-bold uppercase leading-snug tracking-wide text-[#F5F1EB]">
                Seja dono da cultura digital
              </h1>
            </div>
            <div className="relative shrink-0">
              <img
                src="/assets/nft/nft-artwork-03.png"
                alt=""
                className="h-24 w-24 rounded-xl object-cover"
                aria-hidden="true"
              />
            </div>
          </div>
          <div className="px-5 pb-5">
            <p className="text-xs leading-relaxed text-[#F5F1EB]/80">
              Descubra NFTs selecionados de criadores do mundo todo.
            </p>
            <a
              href="#catalogo-nfts"
              className="mt-4 inline-flex items-center gap-2 rounded-sm text-base font-bold uppercase tracking-wide text-[#D28A4C] outline-none transition-colors hover:text-[#E09550] focus-visible:ring-2 focus-visible:ring-[#E09550]"
            >
              Explorar
              <ArrowRight className="w-[18px] h-[18px]" />
            </a>
            <div className="mt-5 flex justify-center gap-2" aria-hidden="true">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D28A4C]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#F5F1EB]/40" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#F5F1EB]/40" />
            </div>
          </div>
        </div>

        {/* Desktop presentation */}
        <div className="hidden md:block">
          <div className="grid items-center gap-16 md:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="text-sm font-bold text-[#F5F1EB]">Bem-vindo à Kurio</p>
              <h1 className="mt-5 max-w-[560px] text-[2.75rem] font-bold uppercase leading-[1.3] text-[#F5F1EB]">
                Seja dono do futuro da arte digital
              </h1>
              <p className="mt-6 max-w-[560px] text-sm leading-relaxed text-[#CFB28C]">
                Descubra NFTs selecionados de criadores emergentes e consagrados. Coleccione arte
                digital rara, apoie artistas e tenha uma parte da cultura da internet.
              </p>
              <div className="mt-9">
                <a
                  href="#catalogo-nfts"
                  className="inline-flex items-center justify-center rounded-md bg-[#D28A4C] px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-[#140D0A] outline-none transition-colors hover:bg-[#E09550] focus-visible:ring-2 focus-visible:ring-[#E09550]"
                >
                  Explorar
                </a>
              </div>
              <div className="mt-12 flex justify-end gap-2.5 pr-10" aria-hidden="true">
                <span className="h-2 w-2 rounded-full bg-[#D28A4C]" />
                <span className="h-2 w-2 rounded-full bg-[#D28A4C]/50" />
                <span className="h-2 w-2 rounded-full bg-[#D28A4C]/50" />
              </div>
            </div>

            <div className="relative">
              <img
                src="/assets/nft/nft-artwork-03.png"
                alt="Emerald Ape #042 — Arte em destaque"
                className="aspect-square w-full rounded-2xl object-cover shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Catalog Section */}
      <section
        id="catalogo-nfts"
        aria-label="Catálogo de NFTs"
        className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-4 md:px-6"
      >
        <div className="grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-14 items-start">
          <aside className="hidden lg:block space-y-6">
            {sidebarContent}

            <div className="rounded-xl bg-[#241612] p-5">
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#E09550]">
                NFT EM DESTAQUE
              </p>
              <p className="mt-1 text-base font-bold text-[#F5F1EB]">
                OFERTA LIMITADA
              </p>
              <Link
                to="/nfts/$nftId"
                params={{ nftId: 'nft-2' }}
                className="mt-5 block outline-none focus-visible:ring-2 focus-visible:ring-[#E09550] group"
              >
                <img
                  src="/assets/nft/nft-artwork-07.png"
                  alt="Sage Nomad #009"
                  loading="lazy"
                  className="aspect-[4/5] w-full rounded-lg object-cover group-hover:scale-[1.02] transition-transform"
                />
                <h3 className="mt-3 truncate text-base font-bold text-[#F5F1EB]">
                  Sage Nomad #009
                </h3>
                <p className="mt-1.5 text-base font-bold text-[#E09550]">
                  1.69 ETH
                </p>
              </Link>
            </div>
          </aside>

          <div className="space-y-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-[#CFB28C]/60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    data-testid="catalog-search-input"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Pesquisar NFT por nome, descrição ou criador..."
                    aria-label="Pesquisar NFTs no catálogo"
                    className="w-full h-10 pl-10 pr-9 rounded-md bg-[#241612] border border-[#3A251C] text-xs sm:text-sm text-[#F5F1EB] placeholder-[#CFB28C]/60 focus:border-[#D28A4C] focus:outline-none"
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
                  className="lg:hidden h-10 px-4 rounded-md bg-[#241612] border border-[#3A251C] text-xs font-bold text-[#F5F1EB] inline-flex items-center gap-2"
                >
                  <Filter className="w-4 h-4 text-[#E09550]" />
                  <span>Filtros</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#3A251C]/60 pb-4">
                <div className="flex items-center gap-6 overflow-x-auto">
                  <button
                    type="button"
                    data-testid="tab-all-nfts"
                    onClick={() => updateFilter({ sort: 'recent', availability: undefined })}
                    className={`rounded-sm px-1 py-1 text-xs font-bold tracking-wide outline-none transition-colors ${
                      activeSort === 'recent' && activeAvailability === 'all'
                        ? 'text-[#E09550] underline decoration-2 underline-offset-8'
                        : 'text-[#F5F1EB] hover:text-[#E09550]'
                    }`}
                  >
                    Todos os NFTs
                  </button>
                  <button
                    type="button"
                    data-testid="tab-available-nfts"
                    onClick={() => updateFilter({ availability: 'available' })}
                    className={`rounded-sm px-1 py-1 text-xs font-bold tracking-wide outline-none transition-colors ${
                      activeAvailability === 'available'
                        ? 'text-[#E09550] underline decoration-2 underline-offset-8'
                        : 'text-[#F5F1EB] hover:text-[#E09550]'
                    }`}
                  >
                    Novos lançamentos
                  </button>
                  <button
                    type="button"
                    data-testid="tab-popular-nfts"
                    onClick={() => updateFilter({ sort: 'popular', availability: undefined })}
                    className={`rounded-sm px-1 py-1 text-xs font-bold tracking-wide outline-none transition-colors ${
                      activeSort === 'popular'
                        ? 'text-[#E09550] underline decoration-2 underline-offset-8'
                        : 'text-[#F5F1EB] hover:text-[#E09550]'
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
                    className="h-9 px-2.5 rounded bg-[#241612] border border-[#3A251C] text-xs sm:text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
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
                className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8 md:gap-x-10 md:gap-y-10"
              >
                {Array.from({ length: 9 }).map((_, idx) => (
                  <NftCardSkeleton key={idx} />
                ))}
              </div>
            ) : isError ? (
              <div
                role="alert"
                data-testid="catalog-error-state"
                className="rounded-xl bg-[#241612] border border-[#F0805F]/50 p-8 text-center space-y-4"
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
                  className="h-10 px-5 rounded-md bg-[#D28A4C] hover:bg-[#E09550] text-[#140D0A] font-bold text-xs uppercase inline-flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Tentar novamente</span>
                </button>
              </div>
            ) : !data || data.items.length === 0 ? (
              <div
                data-testid="catalog-empty-state"
                className="rounded-xl border border-dashed border-[#3A251C] p-10 text-center space-y-4"
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
                  className="h-10 px-5 rounded-md bg-[#D28A4C] hover:bg-[#E09550] text-[#140D0A] font-bold text-xs uppercase transition-colors"
                >
                  Limpar todos os filtros
                </button>
              </div>
            ) : (
              <>
                <div
                  data-testid="catalog-grid"
                  className={`grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8 md:gap-x-10 md:gap-y-10 transition-opacity ${
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
                    className="pt-6 flex items-center justify-between flex-wrap gap-4"
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
                            className={`w-9 h-9 rounded-md text-sm font-bold flex items-center justify-center transition-colors ${
                              isCurrent
                                ? 'bg-[#D28A4C] text-[#140D0A]'
                                : 'bg-[#241612] text-[#F5F1EB] hover:bg-[#2E1B14]'
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
                          className="w-9 h-9 rounded-md bg-[#241612] text-[#CFB28C] hover:text-[#F5F1EB] flex items-center justify-center transition-colors"
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
            <div className="flex items-center justify-between pb-2 border-b border-[#3A251C]">
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

      {/* Featured Collections Promos */}
      <section
        id="criadores"
        aria-label="Coleções em destaque"
        className="mx-auto w-full max-w-[1200px] px-4 py-14 md:px-6 scroll-mt-24"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <article className="flex overflow-hidden rounded-xl bg-[#241612] md:min-h-[280px]">
            <img
              src="/assets/nft/nft-artwork-03.png"
              alt=""
              loading="lazy"
              className="hidden w-[42%] shrink-0 object-cover sm:block"
              aria-hidden="true"
            />
            <div className="flex min-w-0 flex-1 flex-col items-end justify-center p-6 text-right lg:p-8">
              <h2 className="text-base font-bold leading-snug text-[#F5F1EB] lg:text-lg">
                Lançamentos gênese de edição limitada
              </h2>
              <p className="mt-3 text-xs leading-relaxed text-[#CFB28C] lg:text-sm">
                Coleccione edições raras diretamente dos criadores antes da revelação pública.
              </p>
              <a
                href="#catalogo-nfts"
                onClick={() => updateFilter({ category: undefined })}
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#D28A4C] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#140D0A] transition-colors hover:bg-[#E09550]"
              >
                <span>Explorar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </article>

          <article className="flex overflow-hidden rounded-xl bg-[#241612] md:min-h-[280px]">
            <img
              src="/assets/nft/nft-artwork-08.png"
              alt=""
              loading="lazy"
              className="hidden w-[42%] shrink-0 object-cover sm:block"
              aria-hidden="true"
            />
            <div className="flex min-w-0 flex-1 flex-col items-end justify-center p-6 text-right lg:p-8">
              <h2 className="text-base font-bold leading-snug text-[#F5F1EB] lg:text-lg">
                Arte digital selecionadas e muito mais
              </h2>
              <p className="mt-3 text-xs leading-relaxed text-[#CFB28C] lg:text-sm">
                Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.
              </p>
              <a
                href="#catalogo-nfts"
                onClick={() => updateFilter({ category: 'art' })}
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#D28A4C] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#140D0A] transition-colors hover:bg-[#E09550]"
              >
                <span>Explorar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </article>
        </div>
      </section>

      {/* Diário da Cunhagem */}
      <section
        id="diario-cunhagem"
        aria-labelledby="editorial-heading"
        className="mx-auto w-full max-w-[1200px] px-4 pb-16 md:px-6 scroll-mt-24"
      >
        <div className="text-center">
          <h2
            id="editorial-heading"
            className="text-2xl font-bold text-[#F5F1EB]"
          >
            Diário da Cunhagem
          </h2>
          <p className="mt-2 text-xs text-[#CFB28C]">
            Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
          </p>
        </div>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BLOG_POSTS.map((item) => (
            <li key={item.id}>
              <article className="flex h-full flex-col overflow-hidden rounded-xl bg-[#241612]">
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                  aria-hidden="true"
                />
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-[10px] text-[#CFB28C]/80">
                    {item.date} | {item.readingTime}
                  </p>
                  <h3 className="mt-2 text-sm font-bold leading-snug text-[#F5F1EB]">
                    {item.title}
                  </h3>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-[#CFB28C]">
                    {item.excerpt}
                  </p>
                  <p
                    className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#E09550]"
                    aria-hidden="true"
                  >
                    <span>Ler mais</span>
                    <ArrowRight className="w-3 h-3" />
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
