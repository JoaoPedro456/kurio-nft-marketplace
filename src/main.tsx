import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ensureMocksStarted, queueMockCall } from './lib/mocks-ready'
import { applyUrlOverrides, getConfig, setFlag, setNetwork, setOrderResolveMs } from './mocks/config'

applyUrlOverrides()

// Garante que window.__mock esteja disponível sincronicamente desde o primeiro frame
window.__mock = {
  async reset() {
    await ensureMocksStarted()
    await window.__mock.reset()
  },
  getConfig,
  setNetwork,
  setFlag,
  setOrderResolveMs,
  simulatePriceChange: (...args) => queueMockCall((m) => m.simulatePriceChange(...args)),
  simulateSoldOut: (...args) => queueMockCall((m) => m.simulateSoldOut(...args)),
  resolveOrder: (...args) => queueMockCall((m) => m.resolveOrder(...args)),
  expireCurrentSession: () => queueMockCall((m) => m.expireCurrentSession()),
  disconnectWallet: () => queueMockCall((m) => m.disconnectWallet()),
  dropSocket: () => queueMockCall((m) => m.dropSocket()),
  replayEvents: (opts) => queueMockCall((m) => m.replayEvents(opts)),
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

const shouldEagerStartMocks =
  window.location.search.includes('flags=') ||
  Boolean(localStorage.getItem('nft.mock.db')) ||
  Boolean(localStorage.getItem('nft.session'))

if (shouldEagerStartMocks) {
  void ensureMocksStarted()
} else {
  const triggerOnce = () => {
    void ensureMocksStarted()
  }
  window.addEventListener('pointerdown', triggerOnce, { once: true, passive: true })
  window.addEventListener('keydown', triggerOnce, { once: true, passive: true })
  window.addEventListener('touchstart', triggerOnce, { once: true, passive: true })
}
