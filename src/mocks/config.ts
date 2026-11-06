/**
 * Configuração dos cenários de mock. Persistida em localStorage para sobreviver
 * a refresh e controlável por URL (?mock=flag1,flag2&net=slow), pelo painel de
 * desenvolvimento e por `window.__mock` (usado pelos testes Playwright).
 */

export const NETWORK_PROFILES = [
  'instant',
  'normal',
  'slow',
  'variable',
  'out-of-order',
  'offline',
  'timeout',
] as const
export type NetworkProfile = (typeof NETWORK_PROFILES)[number]

export const SCENARIO_FLAGS = {
  'empty-catalog': 'Catálogo retorna resultado vazio',
  'catalog-error-transient':
    'Catálogo falha (HTTP 503) nas 2 primeiras requisições e depois se recupera',
  'catalog-error': 'Catálogo sempre falha com HTTP 500',
  'favorites-fail': 'Inclusão/remoção de favoritos falha com HTTP 500',
  'short-session': 'Sessões expiram 60s após o login',
  'price-change-on-checkout': 'Preço do 1º item sobe 10% ao confirmar o pedido',
  'sold-out-on-checkout': 'Edição do 1º item esgota ao confirmar o pedido',
  'order-timeout': 'Pedido é criado, mas a 1ª resposta excede o timeout do cliente',
  'payment-declined': 'Pagamento é recusado',
  'payment-hold': 'Pagamento permanece pendente até ser resolvido manualmente',
  'wallet-reject': 'Usuário recusa a conexão da carteira',
  'profile-error': 'Atualização de perfil falha com HTTP 503',
} as const
export type ScenarioFlag = keyof typeof SCENARIO_FLAGS

export interface MockConfig {
  network: NetworkProfile
  flags: ScenarioFlag[]
  /** Tempo até a "rede" confirmar/recusar um pedido */
  orderResolveMs: number
  /** Semente do PRNG de latência */
  seed: number
}

const KEY = 'nft.mock.config'

export const DEFAULT_CONFIG: MockConfig = {
  network: 'normal',
  flags: [],
  orderResolveMs: 1600,
  seed: 42,
}

let current: MockConfig = load()
const listeners = new Set<(c: MockConfig) => void>()

function load(): MockConfig {
  try {
    const raw = localStorage.getItem(KEY)
    const stored = raw ? (JSON.parse(raw) as Partial<MockConfig>) : {}
    const cfg = { ...DEFAULT_CONFIG, ...stored }
    const params = new URLSearchParams(location.search)
    const net = params.get('net')
    if (net && (NETWORK_PROFILES as readonly string[]).includes(net)) {
      cfg.network = net as NetworkProfile
    }
    const mock = params.get('mock')
    if (mock !== null) {
      cfg.flags = mock
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is ScenarioFlag => s in SCENARIO_FLAGS)
    }
    if (net || mock !== null) localStorage.setItem(KEY, JSON.stringify(cfg))
    return cfg
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function applyUrlOverrides() {
  current = load()
}

export function getConfig(): MockConfig {
  return current
}

export function setConfig(patch: Partial<MockConfig>): MockConfig {
  current = { ...current, ...patch }
  localStorage.setItem(KEY, JSON.stringify(current))
  listeners.forEach((l) => l(current))
  return current
}

export function setNetwork(profile: NetworkProfile): MockConfig {
  return setConfig({ network: profile })
}

export function setFlag(flag: ScenarioFlag, enabled: boolean): MockConfig {
  const nextFlags = enabled
    ? Array.from(new Set([...current.flags, flag]))
    : current.flags.filter((f) => f !== flag)
  return setConfig({ flags: nextFlags })
}

export function setOrderResolveMs(ms: number): MockConfig {
  return setConfig({ orderResolveMs: ms })
}

export function resetConfig() {
  setConfig({ ...DEFAULT_CONFIG })
}

export function hasFlag(flag: ScenarioFlag) {
  return current.flags.includes(flag)
}

export function onConfigChange(fn: (c: MockConfig) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
