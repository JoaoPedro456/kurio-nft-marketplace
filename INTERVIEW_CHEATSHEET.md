# 🚀 KURIO NFT Marketplace — Guia Rápido de Bolso (1-Page Cheat Sheet)

Tenha esta folha aberta em uma segunda tela durante a entrevista técnica para consultar rapidamente links, caminhos de arquivo, comandos e argumentos.

---

## 📌 Links Essenciais

| Recurso | URL |
| :--- | :--- |
| **Produção (Vercel)** | [https://kurio-nft-marketplace-fawn.vercel.app](https://kurio-nft-marketplace-fawn.vercel.app) |
| **Repositório GitHub** | [https://github.com/JoaoPedro456/kurio-nft-marketplace](https://github.com/JoaoPedro456/kurio-nft-marketplace) |
| **Execuções do CI/CD** | [https://github.com/JoaoPedro456/kurio-nft-marketplace/actions](https://github.com/JoaoPedro456/kurio-nft-marketplace/actions) |

---

## 💻 Terminal: Comandos para Impressionar

```bash
# Rodar todos os testes E2E com a interface visual interativa (Time-Travel)
npx playwright test --ui

# Iniciar o servidor de desenvolvimento
npm run dev

# Rodar validação de tipos e lint (Zero erros)
npm run lint

# Subir a aplicação conteinerizada via Docker (com Nginx e Gzip)
docker compose up --build -d
```

---

## 📂 Mapa de Arquivos & Padrões Chave

| O que você quer mostrar | Onde está o arquivo | Conceito a citar |
| :--- | :--- | :--- |
| **Precisão Financeira** | [`src/lib/money.ts`](file:///C:/Users/joaop/.gemini/antigravity/scratch/nft-marketplace/src/lib/money.ts) | `big.js`, precisão arbitrária, mitigação de `0.1 + 0.2 !== 0.3`. |
| **Stale Quote & Idempotência** | [`src/pages/CheckoutPage.tsx`](file:///C:/Users/joaop/.gemini/antigravity/scratch/nft-marketplace/src/pages/CheckoutPage.tsx) | Modal de reconciliação de preço, volatilidade e `x-idempotency-key`. |
| **Atualização Otimista** | [`src/lib/hooks.ts`](file:///C:/Users/joaop/.gemini/antigravity/scratch/nft-marketplace/src/lib/hooks.ts) | `onMutate` com snapshot, `onError` com rollback e `onSettled`. |
| **Simulação MSW & WebSockets** | [`src/mocks/handlers.ts`](file:///C:/Users/joaop/.gemini/antigravity/scratch/nft-marketplace/src/mocks/handlers.ts) e [`src/mocks/realtime.ts`](file:///C:/Users/joaop/.gemini/antigravity/scratch/nft-marketplace/src/mocks/realtime.ts) | Interceptação Service Worker no client e Socket.IO mock binding. |
| **Mock Devbar (Observabilidade)**| [`src/components/MockDevbar.tsx`](file:///C:/Users/joaop/.gemini/antigravity/scratch/nft-marketplace/src/components/MockDevbar.tsx) | Simulação de latência de rede (0–1500ms), erro 500 e stale quote. |
| **Diagramas de Arquitetura** | [`ARCHITECTURE_DIAGRAM.md`](file:///C:/Users/joaop/.gemini/antigravity/scratch/nft-marketplace/ARCHITECTURE_DIAGRAM.md) | Diagramas Mermaid de sequência e fluxo de dados. |

---

## 🎙️ Respostas Rápidas para as 3 Perguntas Mais Frequentes

1. **"Por que Vite + React 19 em vez de Next.js?"**
   > *"Por ser uma SPA com mock 100% client-side via Service Worker (MSW) e WebSockets sem backend externo. Uma SPA estática na CDN da Vercel oferece custo zero de servidor, carregamento instantâneo e type-safety perfeito com TanStack Router sem o overhead de SSR."*

2. **"Como evitou problemas com números em JavaScript?"**
   > *"Em criptoativos (ETH), pequenas frações em wei e conversões para USD sofrem com ponto flutuante IEEE 754. Centralizei tudo no `big.js`, garantindo precisão matemática exata e arredondamento determinístico."*

3. **"Como garantiu a qualidade de código e acessibilidade?"**
   > *"24 testes automatizados com Playwright cobrindo Desktop e Mobile com regressão visual, além de nota 100 em Acessibilidade e Melhores Práticas no Lighthouse CI através de HTML semântico e primitivos Radix UI."*

---

## 🌟 Perguntas Finais para Você Fazer aos Entrevistadores

1. *"Qual é hoje o maior gargalo técnico do time de frontend e como vocês equilibram refatoração com entrega de novas features?"*
2. *"Como vocês monitoram Core Web Vitals e regressões de performance em produção (RUM)?"*
3. *"Para quem ingressa agora, qual seria a entrega principal que faria os primeiros 90 dias serem considerados um grande sucesso?"*
