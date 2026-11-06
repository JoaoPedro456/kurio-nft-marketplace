# KURIO NFT Marketplace — Diagramas de Arquitetura & Fluxos de Dados

Este documento fornece diagramas visuais prontos para apresentação na entrevista técnica, demonstrando a robustez da engenharia frontend implementada.

---

## 1. Arquitetura Geral da Aplicação

```mermaid
flowchart TD
    subgraph Client["Navegador (Client Runtime)"]
        UI["React 19 Components (Tailwind CSS v4 + Radix UI)"]
        Router["TanStack Router (Type-Safe Navigation)"]
        Cache["TanStack Query v5 (Data Fetching, Cache & Optimistic UI)"]
        MoneyLib["Big.js Precision Money Engine"]
        Devbar["Mock Devbar (Latency & Error Controls)"]
    end

    subgraph ServiceWorkerLayer["Interceptação Service Worker"]
        MSW["Mock Service Worker v2 (msw)"]
        SocketEngine["Socket.IO Mock Engine (@mswjs/socket.io-binding)"]
    end

    subgraph StorageLayer["Persistência Client-Side"]
        LocalStorage["LocalStorage (Favoritos, Carrinho, Auth)"]
    end

    UI --> Router
    UI --> Devbar
    UI --> MoneyLib
    UI --> Cache
    Cache --> MSW
    UI <--> SocketEngine
    Cache <--> LocalStorage
    MSW <--> LocalStorage
```

---

## 2. Fluxo de Checkout com Proteção de Cotação Expirada (Stale Quote) & Idempotência

```mermaid
sequenceDiagram
    autonumber
    actor User as Usuário
    participant Checkout as Tela de Checkout
    participant Engine as Big.js & TanStack Query
    participant MSW as MSW / API Backend

    User->>Checkout: Acessa tela de Checkout
    Checkout->>Engine: Calcula subtotal, taxa de rede e total (Big.js)
    Checkout->>MSW: Solicita cotação atualizada (Quote)
    MSW-->>Checkout: Retorna Quote { id, ethPrice, expiresAt }
    
    Note over Checkout,MSW: Simulação de volatilidade (preço do ETH altera)
    
    User->>Checkout: Clica em "Confirmar e Pagar"
    Checkout->>MSW: POST /api/checkout (x-idempotency-key: UUID)
    
    alt Preço oscilou além do limite permitido (Stale Quote)
        MSW-->>Checkout: HTTP 409 Conflict (PRICE_CHANGED)
        Checkout->>User: Exibe Modal de Reconciliação com novo valor
        User->>Checkout: Aceita nova cotação
        Checkout->>MSW: Reenvia POST /api/checkout com nova cotação
    end

    MSW-->>Checkout: HTTP 201 Created (Order Confirmed)
    Checkout->>User: Redireciona para /orders/:orderId (Sucesso)
```

---

## 3. Ciclo de Vida de Atualização Otimista (Optimistic Updates) em Favoritos

```mermaid
sequenceDiagram
    autonumber
    actor User as Usuário
    participant Button as Botão de Favorito (UI)
    participant QueryCache as TanStack Query Cache
    participant MSW as Backend / MSW

    User->>Button: Clica para favoritar NFT
    Button->>QueryCache: onMutate: Cancela queries ativas
    Button->>QueryCache: Snapshot do estado anterior (Rollback Backup)
    Button->>QueryCache: Atualiza estado local imediatamente (isFavorite = true)
    Button->>User: Ícone preenchido instantaneamente (0ms de atraso percebido)
    
    Button->>MSW: POST /api/nfts/:id/favorite
    
    alt Falha de Rede ou HTTP 500
        MSW-->>Button: Erro na requisição
        Button->>QueryCache: onError: Restaura Snapshot anterior
        Button->>User: Reverte ícone e exibe Toast de erro
    else Sucesso
        MSW-->>Button: HTTP 200 OK
        Button->>QueryCache: onSettled: Invalida query para sincronizar fonte da verdade
    end
```
