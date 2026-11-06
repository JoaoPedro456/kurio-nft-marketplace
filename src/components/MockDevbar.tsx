import { useState } from 'react'
import { Settings2, RefreshCw, WifiOff, Zap, DollarSign, Ban, Clock } from 'lucide-react'
import { toast } from 'sonner'
import {
  getConfig,
  SCENARIO_FLAGS,
  setFlag,
  setNetwork,
  type NetworkProfile,
  type ScenarioFlag,
} from '@/mocks/config'
import { clearUserScopedCache, queryClient } from '@/lib/query'
import { reconnectRealtimeNow, resetRealtimeDedupeState, useRealtimeState } from '@/lib/realtime'
import { sessionStore } from '@/lib/session'

const NETWORK_PROFILES: NetworkProfile[] = [
  'instant',
  'normal',
  'slow',
  'variable',
  'out-of-order',
  'offline',
  'timeout',
]

export function MockDevbar() {
  const [open, setOpen] = useState(false)
  const [, setTick] = useState(0)
  const realtime = useRealtimeState()
  const cfg = getConfig()

  const refresh = () => setTick((t) => t + 1)

  const handleNetworkChange = (profile: NetworkProfile) => {
    setNetwork(profile)
    refresh()
    toast.info(`Perfil de rede alterado para: ${profile}`)
  }

  const handleToggleFlag = (flag: ScenarioFlag) => {
    const enabled = !cfg.flags.includes(flag)
    setFlag(flag, enabled)
    refresh()
  }

  const handleResetAll = async () => {
    await window.__mock?.reset()
    sessionStore.resetAll()
    resetRealtimeDedupeState()
    clearUserScopedCache(queryClient)
    await queryClient.invalidateQueries()
    refresh()
    toast.success('Estado da aplicação e banco MSW restaurados para o padrão.')
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-50 font-mono text-xs">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="mock-devbar-toggle"
          aria-label="Simulador MSW — abrir painel de cenários simulados"
          className={
            typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('devbar')
              ? 'flex items-center gap-2 rounded-full border border-[#55321F] bg-[#241612]/95 px-3.5 py-2 text-[#F5F1EB] shadow-lg backdrop-blur hover:border-[#D28A4C]'
              : 'sr-only focus:not-sr-only focus:flex focus:items-center focus:gap-2 focus:rounded-full focus:border focus:border-[#55321F] focus:bg-[#241612]/95 focus:px-3.5 focus:py-2 focus:text-[#F5F1EB]'
          }
        >
          <Settings2 className="size-4 text-[#E89B55]" />
          <span>Simulador MSW</span>
          <span
            data-testid="realtime-status-pill"
            data-status={realtime.status}
            className={`inline-block size-2 rounded-full ${
              realtime.status === 'connected'
                ? 'bg-emerald-400'
                : realtime.status === 'reconnecting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500'
            }`}
          />
        </button>
      ) : (
        <div
          data-testid="mock-devbar-panel"
          className="w-[360px] max-w-[92vw] rounded-lg border border-[#55321F] bg-[#241612] p-4 text-[#F5F1EB] shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between border-b border-[#3F2319] pb-2">
            <div className="flex items-center gap-2 font-bold text-[#E89B55]">
              <Settings2 className="size-4" />
              <span>Controle MSW & Socket.IO</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-2 py-0.5 text-[#CFB28C] hover:bg-[#2F1D15] hover:text-[#F5F1EB]"
            >
              Fechar
            </button>
          </div>

          <div className="mb-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-[#CFB28C]">
              <span>Perfil de Rede HTTP:</span>
              <span className="font-bold text-[#E89B55]">{cfg.network}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {NETWORK_PROFILES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleNetworkChange(p)}
                  className={`rounded px-2 py-1 text-[11px] transition ${
                    cfg.network === p
                      ? 'bg-[#D28A4C] font-bold text-[#140D0A]'
                      : 'bg-[#2F1D15] text-[#CFB28C] hover:text-[#F5F1EB]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 space-y-1">
            <p className="text-[11px] text-[#CFB28C]">Flags de Cenário Determinístico:</p>
            <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
              {(Object.keys(SCENARIO_FLAGS) as ScenarioFlag[]).map((flag) => {
                const active = cfg.flags.includes(flag)
                return (
                  <label
                    key={flag}
                    title={SCENARIO_FLAGS[flag]}
                    className="flex cursor-pointer items-center justify-between rounded bg-[#2F1D15]/70 px-2 py-1 hover:bg-[#2F1D15]"
                  >
                    <span className="truncate text-[11px]">{flag}</span>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => handleToggleFlag(flag)}
                      className="accent-[#D28A4C]"
                    />
                  </label>
                )
              })}
            </div>
          </div>

          <div className="mb-3 space-y-1.5 border-t border-[#3F2319] pt-2">
            <div className="flex items-center justify-between text-[11px] text-[#CFB28C]">
              <span>
                Socket.IO:{' '}
                <strong className="text-[#F5F1EB]" data-testid="devbar-socket-status">
                  {realtime.status}
                </strong>
              </span>
              <span>
                evts: {realtime.receivedCount} | dup: {realtime.ignoredDuplicatesCount} | stale:{' '}
                {realtime.ignoredStaleCount}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => window.__mock?.simulatePriceChange('nft-1')}
                className="flex items-center justify-center gap-1 rounded bg-[#2F1D15] px-2 py-1.5 text-[11px] text-[#E89B55] hover:bg-[#38220F]"
              >
                <DollarSign className="size-3.5" /> Preço #042 +15%
              </button>
              <button
                type="button"
                onClick={() => window.__mock?.simulateSoldOut('nft-2')}
                className="flex items-center justify-center gap-1 rounded bg-[#2F1D15] px-2 py-1.5 text-[11px] text-[#F0805F] hover:bg-[#38220F]"
              >
                <Ban className="size-3.5" /> Esgotar #009
              </button>
              <button
                type="button"
                onClick={() => {
                  window.__mock?.dropSocket()
                  setTimeout(() => reconnectRealtimeNow(), 1200)
                }}
                className="flex items-center justify-center gap-1 rounded bg-[#2F1D15] px-2 py-1.5 text-[11px] text-[#CFB28C] hover:bg-[#38220F]"
              >
                <WifiOff className="size-3.5" /> Queda Socket
              </button>
              <button
                type="button"
                onClick={() => window.__mock?.replayEvents({ duplicateLast: true, staleVersion: true })}
                className="flex items-center justify-center gap-1 rounded bg-[#2F1D15] px-2 py-1.5 text-[11px] text-[#CFB28C] hover:bg-[#38220F]"
              >
                <Zap className="size-3.5" /> Replay Dup/Stale
              </button>
              <button
                type="button"
                onClick={() => {
                  window.__mock?.expireCurrentSession()
                  toast.warning('Sessão marcada como expirada no servidor MSW.')
                }}
                className="col-span-2 flex items-center justify-center gap-1 rounded bg-[#2F1D15] px-2 py-1.5 text-[11px] text-[#CFB28C] hover:bg-[#38220F]"
              >
                <Clock className="size-3.5" /> Expirar Sessão Atual
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetAll}
            data-testid="mock-reset-button"
            className="flex w-full items-center justify-center gap-1.5 rounded bg-[#D28A4C] py-2 font-bold text-[#140D0A] hover:bg-[#E89B55]"
          >
            <RefreshCw className="size-3.5" /> Resetar Banco e Cenários
          </button>
        </div>
      )}
    </div>
  )
}

