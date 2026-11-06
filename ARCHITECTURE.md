# Arquitetura da Aplicação — KURIO NFT Marketplace

Este documento descreve as decisões arquiteturais, o fluxo de dados REST + tempo real, a estratégia de cache e idempotência, e os trade-offs adotados na construção do **KURIO NFT Marketplace**.

---

## 1. Organização de Pastas e Responsabilidades

```text
src/
├── components/
│   ├── Layout.tsx            # Header KURIO, alertas de sessão/socket, busca rápida, Footer e nav mobile
│   ├── NftCard.tsx           # Card fiel ao Figma com ações rápidas, badge RARO e preço em ETH
│   ├── NftCardSkeleton.tsx   # Placeholder shimmer sem layout shift (CLS = 0)
│   └── MockDevbar.tsx        # Painel interativo para controle de rede, flags MSW e eventos Socket.IO
├── lib/
│   ├── api/
│   │   ├── contracts.ts      # Contratos TypeScript compartilhados entre cliente e MSW
│   │   └── client.ts         # Instância única Axios (httpClient), interceptors e classe AppApiError
│   ├── hooks.ts              # Hooks do TanStack Query (queries, mutations e updates otimistas)
│   ├── money.ts              # Aritmética decimal exata em ETH (18 casas) com big.js
│   ├── query.ts              # QueryClient, fábrica hierárquica queryKeys e limpeza de cache por escopo
│   ├── realtime.ts           # Cliente socket.io-client, deduplicação por id/version e reconciliação
│   └── session.ts            # Store reativa (useSyncExternalStore) de sessão, guestCartId e rascunho de checkout
├── mocks/
│   ├── handlers/
│   │   ├── account.ts        # Handlers MSW de auth, sessão, perfil, avatar, senha, catálogo e favoritos
│   │   └── commerce.ts       # Handlers MSW de carrinho, cupom, merge, cotação, pedidos idempotentes e carteiras
│   ├── browser.ts            # Inicialização do Service Worker MSW, timer de liquidação e API window.__mock
│   ├── config.ts             # Perfis de latência e flags determinísticas de cenário
│   ├── db.ts                 # Banco em memória persistido em localStorage + hash SHA-256 de senhas
│   ├── domain.ts             # Regras de negócio simuladas e emissão de eventos Socket.IO
│   ├── fixtures.ts           # 36 NFTs (9 primeiros idênticos ao Figma KURIO) com PRNG determinístico
│   ├── http.ts               # Helpers de autenticação Bearer, validação e envelope de erro
│   ├── network.ts            # Simulador de latência, jitter, inversão de ordem, offline e timeout
│   └── realtime.ts           # Servidor Socket.IO via MSW ws.link + @mswjs/socket.io-binding
├── pages/
│   ├── HomePage.tsx          # Hero, Sidebar de filtros, abas, busca com debounce, grid paginado e blog
│   ├── NftDetailPage.tsx     # Galeria, seletor de edição (1/50, 1/10, 1/1, ABERTA), stepper e tabs
│   ├── CartPage.tsx          # Tabela de itens, alerta de mudança de preço/estoque, cupom e resumo
│   ├── CheckoutPage.tsx      # Formulário do colecionador, conexão de carteira, modal 409 QUOTE_STALE e retry idempotente
│   ├── OrderPage.tsx         # Recibo modal KURIO com status em tempo real (pending -> confirmed / declined)
│   ├── AuthPage.tsx          # Modal 500px Entrar | Criar conta com merge automático do carrinho visitante
│   └── AccountPage.tsx       # Painel Meu Perfil (dados, avatar, senha) e Carteiras (principal e secundárias)
└── router.tsx                # Árvore de rotas tipada no TanStack Router com validação de search params
```

---

## 2. Camada de Serviço HTTP com Axios e Contrato de Erros

Toda comunicação REST passa obrigatoriamente pela instância `httpClient` ([`src/lib/api/client.ts`](file:///C:/Users/joaop/.gemini/antigravity/scratch/nft-marketplace/src/lib/api/client.ts)):

1. **Request Interceptor**:
   - Injeta `Authorization: Bearer <token>` quando há sessão autenticada.
   - Injeta `X-Cart-Id: <guestCartId>` para identificar o carrinho de visitante antes do login.
   - Em `POST /api/orders`, envia o cabeçalho obrigatório `Idempotency-Key`.
2. **Response Interceptor & Normalização (`AppApiError`)**:
   - Qualquer falha HTTP (`4xx`/`5xx`), timeout (`ECONNABORTED`) ou erro de rede sem resposta é convertido em uma instância tipada de `AppApiError` contendo `{ status, code, message, fields, details, isTimeout, isNetworkError }`.
   - Quando o servidor retorna `401` com código `SESSION_EXPIRED`, o interceptor aciona `sessionStore.markSessionExpired()`, exibindo um alerta contextual e preservando o rascunho do checkout para que o usuário retome do ponto exato após relogar.

---

## 3. Estratégia de Cache, Chaves e Atualizações Otimistas (TanStack Query)

As chaves de cache são centralizadas em [`src/lib/query.ts`](file:///C:/Users/joaop/.gemini/antigravity/scratch/nft-marketplace/src/lib/query.ts):
- `['nfts', 'list', params]` — listagens paginadas e filtradas do catálogo;
- `['nfts', 'detail', id]` — detalhe individual do NFT;
- `['favorites', userId]` — lista de IDs favoritados pelo usuário;
- `['cart', scopeId]` — carrinho escopado por `guest:<id>` ou `user:<id>`;
- `['quote', userId, network, cartUpdatedAt]` — cotação vinculada à versão atual do carrinho e à rede escolhida;
- `['orders', userId, orderId]` — estado do pedido com polling de fallback enquanto `status === 'pending'`.

### Atualização Otimista com Rollback
Em `useToggleFavoriteMutation` ([`src/lib/hooks.ts`](file:///C:/Users/joaop/.gemini/antigravity/scratch/nft-marketplace/src/lib/hooks.ts)), o clique no coração atualiza imediatamente `queryKeys.favorites(userId)` via `onMutate`, salvando o snapshot anterior. Caso o MSW retorne erro (`?mock=favorites-fail`), `onError` restaura o snapshot anterior e exibe um toast explicativo.

### Isolamento no Logout
Ao sair da conta, `clearUserScopedCache()` remove imediatamente todas as entradas de `favorites`, `cart`, `quote`, `wallets`, `orders` e `profile`, e rotaciona o `guestCartId`, impedindo qualquer vazamento de estado entre sessões.

---

## 4. Protocolo Socket.IO em Tempo Real, Deduplicação e Reconciliação

A conexão em tempo real utiliza o cliente oficial `socket.io-client` ([`src/lib/realtime.ts`](file:///C:/Users/joaop/.gemini/antigravity/scratch/nft-marketplace/src/lib/realtime.ts)) interceptado na camada de rede pelo MSW via `ws.link` + `@mswjs/socket.io-binding` ([`src/mocks/realtime.ts`](file:///C:/Users/joaop/.gemini/antigravity/scratch/nft-marketplace/src/mocks/realtime.ts)).

### Envelope e Versionamento Monotônico
Todos os eventos seguem o envelope `EventEnvelope<TType, TData>`:
- `id`: identificador único do evento (`evt-...`);
- `resource`: `{ type: 'nft' | 'order', id: string }`;
- `version`: número inteiro monotônico incrementado a cada mutação do recurso;
- `data`: payload tipado (`nft.updated` ou `order.updated`).

### Deduplicação e Proteção contra Eventos Fora de Ordem
O cliente mantém dois conjuntos em memória:
1. `seenEventIds: Set<string>` — descarta eventos retransmitidos com o mesmo `id` (`ignoredDuplicatesCount++`).
2. `resourceVersions: Map<string, number>` — semeado pelas respostas HTTP (`seedResourceVersion`) e atualizado a cada evento aceito. Qualquer evento com `evt.version <= knownVersion` é descartado como obsoleto (`ignoredStaleCount++`), garantindo que um evento atrasado jamais sobrescreva um dado mais novo no cache do TanStack Query.

### Reconexão e Reconciliação
Quando a conexão cai (`dropSocket()`), a UI exibe o banner de reconexão sem bloquear a navegação. Assim que o evento `connect` dispara novamente após uma queda, o cliente executa `invalidateQueries` em `nfts`, `cart`, `orders` e `quote`, reconciliando qualquer evento perdido durante a janela offline.

---

## 5. Precisão Financeira em ETH e Idempotência no Checkout

- **Aritmética Decimal Exata (`big.js`)**: Valores em ETH trafegam sempre como `string` nos contratos REST/Socket.IO e são calculados com 18 casas decimais em [`src/lib/money.ts`](file:///C:/Users/joaop/.gemini/antigravity/scratch/nft-marketplace/src/lib/money.ts), evitando erros de ponto flutuante IEEE 754 (`0.1 + 0.2 !== 0.30000000000000004`).
- **Idempotência de Pedidos**: Antes de chamar `POST /api/orders`, o checkout gera uma `idempotencyKey` (`idem-<uuid>`) e a persiste em `localStorage`. Se a requisição sofrer timeout (`order-timeout`) ou queda de rede, clicar em **"Tentar novamente com segurança"** reenvia a mesma `Idempotency-Key`. O handler MSW detecta a chave existente com o mesmo hash de payload e devolve o pedido já criado (`200 OK`) sem duplicar cobrança nem decrementar o estoque duas vezes.

---

## 6. Responsividade, Acessibilidade e Desempenho

- **Fidelidade Visual KURIO**: Paleta escura quente (`#140D0A`, `#241612`, `#3F2319`, `#D28A4C`, `#E89B55`, `#F5F1EB`) e tipografia `Roboto Mono` alinhadas ao Figma em Desktop (`1440px`) e Mobile (`390px`), com barra inferior fixa no mobile e áreas de toque mínimas de `44×44px`.
- **Acessibilidade (WCAG AA)**: Semântica HTML5 (`header`, `nav`, `main`, `aside`, `footer`, `article`), link "Pular para o conteúdo principal", `aria-pressed` nos botões de favorito, `role="radiogroup"` no seletor de edições, `role="alert"` nos banners de erro e anéis de foco visíveis (`:focus-visible`).
- **Web Vitals (LCP & CLS)**: Preload da imagem principal no `index.html` com `fetchpriority="high"`, dimensões explícitas (`width`/`height` e `aspect-ratio`) em todos os cards e skeletons, e animações respeitando `prefers-reduced-motion: reduce`.

---

## 7. Trade-offs e Evoluções Futuras

- **Persistência no Cliente (`localStorage`)**: Para que o avaliador possa testar recarregamento de página, reconexão e múltiplos fluxos mesmo na URL pública da Vercel sem depender de um banco externo, o estado do MSW é sincronizado em `localStorage` com botão de reset instantâneo.
- **Evoluções com mais tempo**:
  - Internacionalização (`i18n`) pt-BR / en-US;
  - Histórico visual de variação de preço em gráfico SVG por edição;
  - Assinatura criptográfica real EIP-712 via `window.ethereum` (mantendo o adaptador MSW como fallback determinístico para CI).
