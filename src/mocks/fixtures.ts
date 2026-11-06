import type { Creator, Network, Nft, NftCategory, NftEdition } from '@/lib/api/contracts'

/** PRNG determinístico (mulberry32) para fixtures reproduzíveis */
export function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const CREATORS: Creator[] = [
  { id: 'c1', name: 'Nova Sato', username: 'novasato', avatarUrl: '/images/avatars/creator-1.svg' },
  { id: 'c2', name: 'Kael Vance', username: 'kaelvance', avatarUrl: '/images/avatars/creator-2.svg' },
  { id: 'c3', name: 'Liora Reyes', username: 'liorareyes', avatarUrl: '/images/avatars/creator-3.svg' },
  { id: 'c4', name: 'Orion Zayd', username: 'orionzayd', avatarUrl: '/images/avatars/creator-4.svg' },
  { id: 'c5', name: 'Animakid', username: 'animakid', avatarUrl: '/images/avatars/creator-1.svg' },
  { id: 'c6', name: 'Keepitreal', username: 'keepitreal', avatarUrl: '/images/avatars/creator-2.svg' },
  { id: 'c7', name: 'DigiLab', username: 'digilab', avatarUrl: '/images/avatars/creator-3.svg' },
  { id: 'c8', name: 'GravityOne', username: 'gravityone', avatarUrl: '/images/avatars/creator-4.svg' },
]

const CATEGORIES: NftCategory[] = ['art', 'collectibles', 'music', 'photography', 'gaming', 'sports']
const NETWORKS: Network[] = ['ethereum', 'polygon', 'arbitrum']

const FIGMA_PRESETS: Array<{
  name: string
  tokenId: string
  price: string
  compareAtPrice?: string
  badge?: string
  category: NftCategory
  collection: string
  network: Network
  img: number
  attributes: string[]
}> = [
  {
    name: 'Emerald Ape #042',
    tokenId: '#0042',
    price: '1.19',
    category: 'art',
    collection: 'Kurio Apes',
    network: 'ethereum',
    img: 1,
    attributes: ['Óculos', 'Esmeralda', 'Raro'],
  },
  {
    name: 'Sage Nomad #009',
    tokenId: '#0009',
    price: '1.69',
    category: 'photography',
    collection: 'Kurio Editions',
    network: 'ethereum',
    img: 2,
    attributes: ['Sálvia', 'Nômade', 'Verificado'],
  },
  {
    name: 'Neon Vessel #552',
    tokenId: '#0552',
    price: '1.99',
    compareAtPrice: '2.29',
    badge: 'RARO',
    category: 'collectibles',
    collection: 'Kurio Vessels',
    network: 'polygon',
    img: 3,
    attributes: ['Neon', 'Cápsula', 'Raro'],
  },
  {
    name: 'Cosmic Bloom #118',
    tokenId: '#0118',
    price: '1.29',
    category: 'art',
    collection: 'Kurio Blooms',
    network: 'ethereum',
    img: 6,
    attributes: ['Cósmico', 'Botânico', 'Gênesis'],
  },
  {
    name: 'Violet Nomad #314',
    tokenId: '#0314',
    price: '1.39',
    category: 'collectibles',
    collection: 'Kurio Editions',
    network: 'polygon',
    img: 7,
    attributes: ['Violeta', 'Nômade', 'Edição Limitada'],
  },
  {
    name: 'Ivory Baron #088',
    tokenId: '#0088',
    price: '1.79',
    category: 'art',
    collection: 'Kurio Barons',
    network: 'ethereum',
    img: 8,
    attributes: ['Marfim', 'Coroa', 'Clássico'],
  },
  {
    name: 'Golden Beat #207',
    tokenId: '#0207',
    price: '0.99',
    category: 'music',
    collection: 'Kurio Beats',
    network: 'arbitrum',
    img: 4,
    attributes: ['Dourado', 'Sintetizador', 'Áudio Desbloqueável'],
  },
  {
    name: 'Obsidian Pulse #144',
    tokenId: '#0144',
    price: '0.59',
    category: 'music',
    collection: 'Kurio Signals',
    network: 'polygon',
    img: 5,
    attributes: ['Obsidiana', 'Pulso', 'Imersivo'],
  },
  {
    name: 'Golden Signal #160',
    tokenId: '#0160',
    price: '0.39',
    category: 'gaming',
    collection: 'Kurio Signals',
    network: 'ethereum',
    img: 4,
    attributes: ['Sinal', 'Ouro', 'Utilitário'],
  },
]

const ADJ = ['Distant', 'Neon', 'Cosmic', 'Silent', 'Golden', 'Liquid', 'Electric', 'Crystal', 'Velvet', 'Lunar', 'Solar', 'Hidden']
const NOUN = ['Galaxy', 'Dreams', 'Vessel', 'Nomad', 'Garden', 'Horizon', 'Echo', 'Baron', 'Ocean', 'Portal', 'Bloom', 'Signal']
const COLLECTIONS = ['Kurio Apes', 'Kurio Editions', 'Kurio Vessels', 'Kurio Blooms', 'Kurio Barons', 'Kurio Signals']

export const NFT_IMAGE_COUNT = 8
export const NFT_COUNT = 36

function priceStr(r: number): string {
  const v = Math.round((0.15 + r * 3.1) * 100) / 100
  return v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export function buildNfts(): Nft[] {
  const rand = prng(20261105)
  const base = Date.UTC(2026, 9, 25)
  const list: Nft[] = []

  for (let i = 0; i < NFT_COUNT; i++) {
    const n = i + 1
    const preset = FIGMA_PRESETS[i]
    const name = preset ? preset.name : `${ADJ[i % ADJ.length]} ${NOUN[(i * 5) % NOUN.length]} #${String(100 + n)}`
    const tokenId = preset ? preset.tokenId : `#${String(100 + n).padStart(4, '0')}`
    const category = preset ? preset.category : CATEGORIES[i % CATEGORIES.length]
    const collection = preset ? preset.collection : COLLECTIONS[i % COLLECTIONS.length]
    const network = preset ? preset.network : NETWORKS[i % NETWORKS.length]
    const creator = CREATORS[i % CREATORS.length]
    const basePrice = preset ? preset.price : priceStr(rand())

    const soldOutItem = i === 15 || i === 27
    const editions: NftEdition[] = [
      {
        id: `nft-${n}-e1`,
        name: '1/50',
        price: basePrice,
        supply: 50,
        available: soldOutItem ? 0 : 12,
        enabled: true,
        maxPerOrder: 6,
      },
      {
        id: `nft-${n}-e2`,
        name: '1/10',
        price: (Math.round(Number(basePrice) * 1.4 * 100) / 100).toString(),
        supply: 10,
        available: soldOutItem ? 0 : 4,
        enabled: true,
        maxPerOrder: 3,
      },
      {
        id: `nft-${n}-e3`,
        name: '1/1',
        price: (Math.round(Number(basePrice) * 2.2 * 100) / 100).toString(),
        supply: 1,
        available: soldOutItem || i % 5 === 3 ? 0 : 1,
        enabled: true,
        maxPerOrder: 1,
      },
      {
        id: `nft-${n}-e4`,
        name: 'ABERTA',
        price: (Math.round(Number(basePrice) * 1.15 * 100) / 100).toString(),
        supply: 100,
        available: soldOutItem ? 0 : 25,
        enabled: i % 4 !== 2, // Algumas edições ABERTA ficam pausadas para testar estado desabilitado
        maxPerOrder: 10,
      },
    ]

    const imgPrimary = preset ? preset.img : (i % NFT_IMAGE_COUNT) + 1
    const imgB = ((imgPrimary + 1) % NFT_IMAGE_COUNT) + 1
    const imgC = ((imgPrimary + 3) % NFT_IMAGE_COUNT) + 1
    const imgD = ((imgPrimary + 5) % NFT_IMAGE_COUNT) + 1

    // Sort `recent` ordena por createdAt desc: garantimos que nft-1 seja o mais recente
    const createdAt = new Date(base - i * 3600_000 * 6).toISOString()

    const nft: Nft = {
      id: `nft-${n}`,
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${n}`,
      name,
      tokenId,
      description: `Um colecionável digital finalizado à mão da coleção ${collection}, verificado na ${network === 'ethereum' ? 'Ethereum' : network === 'polygon' ? 'Polygon' : 'Arbitrum'}, com arte desbloqueável e acesso para colecionadores.`,
      category,
      collection,
      network,
      compareAtPrice: preset?.compareAtPrice,
      badge: preset?.badge,
      rating: 4,
      reviewsCount: 19 + (i % 14),
      attributes: preset?.attributes ?? ['Verificado', 'Alta Resolução', 'Raro'],
      creator,
      images: [
        { src: `/images/nfts/nft-${imgPrimary}.png`, alt: `${name} — arte principal` },
        { src: `/images/nfts/nft-${imgB}.png`, alt: `${name} — variação 2` },
        { src: `/images/nfts/nft-${imgC}.png`, alt: `${name} — variação 3` },
        { src: `/images/nfts/nft-${imgD}.png`, alt: `${name} — variação 4` },
      ],
      editions,
      floorPrice: '0',
      totalAvailable: 0,
      likes: 120 + ((NFT_COUNT - i) * 17) % 600,
      createdAt,
      tags: [category, collection.toLowerCase(), network],
      version: 1,
    }
    list.push(recomputeDerived(nft))
  }
  return list
}

/** Recalcula campos derivados (floorPrice/totalAvailable) a partir das edições */
export function recomputeDerived(nft: Nft): Nft {
  const sellable = nft.editions.filter((e) => e.enabled && e.available > 0)
  const pool = sellable.length ? sellable : nft.editions
  const floor = pool.reduce((min, e) => (Number(e.price) < Number(min) ? e.price : min), pool[0].price)
  return {
    ...nft,
    floorPrice: floor,
    totalAvailable: nft.editions.reduce((s, e) => s + (e.enabled ? e.available : 0), 0),
  }
}

export interface CouponFixture {
  code: string
  description: string
  percentOff: number
  expiresAt: string
}

export const COUPONS: CouponFixture[] = [
  { code: 'NFT10', description: '10% de desconto', percentOff: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'WELCOME25', description: '25% de desconto para novos colecionadores', percentOff: 25, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'KURIO10', description: '10% de desconto Kurio', percentOff: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'EXPIRED20', description: '20% de desconto (expirado)', percentOff: 20, expiresAt: '2024-01-01T00:00:00.000Z' },
]

/** Usuários de demonstração. Senhas: ver README (armazenadas apenas como hash). */
export const SEED_USERS = [
  {
    id: 'u1',
    name: 'Ana Colecionadora',
    username: 'ana',
    email: 'ana@nft.test',
    password: 'Senha@123',
    bio: 'Colecionadora de arte generativa na Kurio.',
  },
  {
    id: 'u2',
    name: 'Bruno Trader',
    username: 'bruno',
    email: 'bruno@nft.test',
    password: 'Senha@123',
    bio: 'Fã de música, fotografia e edições raras.',
  },
] as const

