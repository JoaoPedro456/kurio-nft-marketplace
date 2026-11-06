# KURIO — NFT Marketplace (Desafio Técnico Frontend)

Aplicação web completa de marketplace de NFTs (**KURIO**), construída com **React 19**, **TypeScript**, **Vite**, **TanStack Router**, **TanStack Query**, **Axios**, **Socket.IO (`socket.io-client`)**, **Tailwind CSS v4**, **MSW v2 (`msw` + `@mswjs/socket.io-binding`)**, **Playwright** e **Lighthouse CI**.

---

## 🌐 URL Pública de Produção

- **URL Oficial de Produção:** [https://kurio-nft-marketplace-joaopedro456s-projects.vercel.app](https://kurio-nft-marketplace-joaopedro456s-projects.vercel.app)
- **URL Alternativa (Vercel):** [https://kurio-nft-marketplace-fawn.vercel.app](https://kurio-nft-marketplace-fawn.vercel.app)
- Toda a camada de simulação (**MSW REST + Socket.IO WebSocket via Service Worker**) está ativa em produção, permitindo testar qualquer fluxo, latência, erro ou evento em tempo real diretamente pelo navegador sem necessitar de backend externo.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- **Node.js** `>= 20.x`
- **npm** `>= 10.x`

### 1. Instalar dependências
```bash
npm install
```

### 2. Iniciar servidor de desenvolvimento
```bash
npm run dev
```
Acesse `http://localhost:5173`.

### 3. Gerar build de produção e visualizar localmente
```bash
npm run build
npm run preview -- --port 4173
```
Acesse `http://localhost:4173`.

### 4. Executar via Docker (Opcional)
```bash
docker compose up --build
```
Acesse `http://localhost:3000`.

---

## 🧪 Como Executar Testes E2E, Regressão Visual e Lighthouse

### Testes E2E + Regressão Visual (Playwright)
Executa os **12 cenários obrigatórios** nos viewports **Desktop (`1440×900`)** e **Mobile (`390×844`)**, incluindo comparação de snapshots visuais (`toHaveScreenshot`):
```bash
npx playwright test
```

Para atualizar os snapshots de referência (baselines visuais):
```bash
npx playwright test --update-snapshots
```

Para abrir o relatório HTML interativo do Playwright:
```bash
npx playwright show-report
```

### Auditoria de Qualidade e Web Vitals (Lighthouse CI)
Executa 3 rodadas de auditoria nas páginas **Home (`/`)** e **Detalhe do NFT (`/nfts/nft-1`)** em Mobile e Desktop e salva os 12 relatórios HTML + JSON em `./lighthouse-reports`:
```bash
npm run lighthouse
npm run lighthouse:desktop
```

#### Resultados Obtidos no Lighthouse (Mediana de 3 Execuções)
| Página | Perfil | Performance (meta ≥ 90) | Accessibility (meta ≥ 95) | Best Practices (meta ≥ 95) | SEO (meta ≥ 90) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `/` (Catálogo Home) | **Mobile** | **91** (`91, 91, 91`) | **100** | **100** | **92** |
| `/nfts/nft-1` (Detalhe NFT) | **Mobile** | **93** (`92, 93, 93`) | **100** | **100** | **92** |
| `/` (Catálogo Home) | **Desktop** | **100** (`99, 100, 100`) | **100** | **100** | **92** |
| `/nfts/nft-1` (Detalhe NFT) | **Desktop** | **100** (`100, 100, 100`) | **100** | **100** | **92** |

#### Resultados da Suíte Playwright (E2E + Regressão Visual)
- **24/24 testes aprovados (`100%`)**: 12 cenários obrigatórios executados em `desktop-chromium` (`1440×900`) e `mobile-chromium` (`390×844`).
- **6 baselines de regressão visual** geradas e validadas em `tests/e2e/marketplace.spec.ts-snapshots/` (`home-catalog`, `nft-detail`, `cart-page` em Desktop e Mobile).
- Relatório HTML salvo em `./playwright-report/index.html`.

---

## 🔑 Credenciais, Cupons e Carteiras de Teste

### Contas Pré-cadastradas (Seed)
| Papel | E-mail | Senha | Carteira Principal |
| :--- | :--- | :--- | :--- |
| Colecionadora Principal | `ana@nft.test` | `Senha@123` | `0x71C0...8976F` (Ethereum / Polygon / Arbitrum) |
| Colecionador Secundário | `bruno@nft.test` | `Senha@123` | `0x82D1...9123A` (Ethereum / Polygon) |

*(Na tela de `/login`, você também pode clicar no botão **"Usar conta demo (ana@nft.test)"** para preencher automaticamente).*

### Cupons Promocionais Disponíveis
| Código | Regra / Desconto | Status |
| :--- | :--- | :--- |
| `NFT10` | **10% de desconto** sobre o subtotal em ETH | Válido |
| `WELCOME25` | **25% de desconto** de boas-vindas | Válido |
| `KURIO10` | **10% de desconto** exclusivo Kurio | Válido |
| `EXPIRED20` | Cupom vencido para teste de erro (`422 COUPON_EXPIRED`) | Expirado |

---

## 🎛️ Como Acionar os Cenários Simulados (MSW & Socket.IO)

A aplicação oferece **3 formas** sincronizadas de controlar os cenários determinísticos:

### 1. Painel Flutuante (`Simulador MSW`) na Interface
No canto inferior direito de qualquer tela, clique no botão **"Simulador MSW"** para:
- Alternar o **Perfil de Rede HTTP**: `instant`, `normal` (150–600ms), `slow` (1.2–2.2s), `variable`, `out-of-order`, `offline` ou `timeout`.
- Ativar/desativar **Flags de Cenário Determinístico** (listadas abaixo).
- Disparar eventos **Socket.IO em tempo real** (`Preço #042 +15%`, `Esgotar #009`, `Queda Socket`, `Replay Dup/Stale`, `Expirar Sessão Atual`).
- Clicar em **"Resetar Banco e Cenários"** para restaurar todas as fixtures ao estado inicial.

### 2. Parâmetros de URL (`?net=...&mock=...`)
Você pode compartilhar ou abrir diretamente qualquer rota com parâmetros de simulação:
- `?net=instant` — latência zero (ideal para testes rápidos)
- `?net=slow` — latência alta (1.2s a 2.2s) para inspecionar skeletons e spinners
- `?mock=empty-catalog` — força o catálogo a retornar lista vazia
- `?mock=catalog-error-transient` — falha com HTTP 503 nas 2 primeiras requisições e recupera na 3ª
- `?mock=catalog-error` — falha permanente com HTTP 500 no catálogo
- `?mock=favorites-fail` — falha com HTTP 500 ao favoritar/desfavoritar (demonstra rollback otimista)
- `?mock=price-change-on-checkout` — altera o preço do 1º item ao confirmar o pedido (`409 QUOTE_STALE`)
- `?mock=sold-out-on-checkout` — esgota o 1º item no momento da confirmação
- `?mock=order-timeout` — cria o pedido no servidor mas estoura o timeout na 1ª resposta (testa retry idempotente)
- `?mock=payment-declined` — pedido resolve para `declined` e libera o estoque reservado
- `?mock=payment-hold` — mantém o pedido em `pending` até resolução manual
- `?mock=wallet-reject` — simula recusa de assinatura na carteira (`403 WALLET_REJECTED`)

### 3. API Global `window.__mock` (Console / Playwright)
```js
await window.__mock.reset()
window.__mock.setNetwork('instant')
window.__mock.setFlag('price-change-on-checkout', true)
window.__mock.simulatePriceChange('nft-1', 'nft-1-e1', '1.45')
window.__mock.simulateSoldOut('nft-3')
window.__mock.dropSocket()
window.__mock.replayEvents({ duplicateLast: true, staleVersion: true })
window.__mock.expireCurrentSession()
```
