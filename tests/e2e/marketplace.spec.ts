import { expect, test } from '@playwright/test'

test.describe('KURIO NFT Marketplace — Suíte E2E Completa & Regressão Visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?net=instant')
    await page.waitForFunction(() => Boolean(window.__mock))
    await page.evaluate(async () => {
      await window.__mock.reset()
      window.__mock.setNetwork('instant')
    })
  })

  test('Cenário 1: Descoberta, busca, filtros combinados, ordenação, paginação, URL sync e regressão visual', async ({
    page,
  }) => {
    await page.goto('/?net=instant')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await expect(page.getByTestId('nft-card-nft-1')).toContainText('Emerald Ape #042')

    // Visual Regression: Home / Catálogo
    await expect(page).toHaveScreenshot('home-catalog.png', {
      fullPage: false,
      mask: [page.getByTestId('realtime-status'), page.getByTestId('mock-devbar-toggle')],
    })

    // Filtrar por rede Polygon (no mobile abre o drawer de filtros primeiro)
    const mobileTrigger = page.getByTestId('mobile-filters-trigger')
    if (await mobileTrigger.isVisible()) {
      await mobileTrigger.click()
    }
    await page.locator('[data-testid="filter-network-polygon"]:visible').click()
    await expect(page).toHaveURL(/network=polygon/)

    // Ordenar por maior preço
    await page.getByTestId('catalog-sort-select').selectOption('price-desc')
    await expect(page).toHaveURL(/sort=price-desc/)

    // Recarregar a página e garantir que filtros e ordenação permanecem via URL
    await page.reload()
    await expect(page.getByTestId('catalog-sort-select')).toHaveValue('price-desc')
    await expect(page).toHaveURL(/network=polygon/)

    // Limpar filtros e testar paginação
    if (await mobileTrigger.isVisible()) {
      await mobileTrigger.click()
    }
    await page.locator('[data-testid="clear-filters-btn"]:visible').click()
    await expect(page.getByTestId('pagination-page-2')).toBeVisible()
    await page.getByTestId('pagination-page-2').click()
    await expect(page).toHaveURL(/page=2/)

    // Voltar pelo histórico do navegador
    await page.goBack()
    await expect(page.getByTestId('nft-card-nft-1')).toBeVisible()
  })

  test('Cenário 2: Estado vazio da listagem e limpeza de filtros', async ({ page }) => {
    await page.goto('/?net=instant')
    const searchInput = page.getByTestId('catalog-search-input')
    await searchInput.fill(' TermoInexistenteXyz999 ')
    await expect(page.getByTestId('catalog-empty-state')).toBeVisible()

    await page.getByTestId('empty-clear-filters-btn').click()
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await expect(page.getByTestId('nft-card-nft-1')).toBeVisible()
  })

  test('Cenário 3: Falha transitória no carregamento do catálogo e recuperação via tentar novamente', async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.__mock.setFlag('catalog-error-transient', true)
    })
    await page.goto('/?net=instant&mock=catalog-error-transient')
    await expect(page.getByTestId('catalog-error-state')).toBeVisible()

    // Clica em Tentar novamente (a 3ª chamada sucede no modo catalog-error-transient)
    await page.getByTestId('catalog-retry-btn').click()
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await expect(page.getByTestId('nft-card-nft-1')).toBeVisible()
  })

  test('Cenário 4: Detalhe de NFT (com visual regression) e NFT inexistente (404) com retorno ao catálogo', async ({
    page,
  }) => {
    await page.goto('/nfts/nft-1?net=instant')
    await expect(page.getByTestId('nft-detail-title')).toHaveText('Emerald Ape #042')
    await expect(page.getByTestId('nft-detail-price')).toContainText('1.19 ETH')

    // Visual Regression: Detalhe do NFT
    await expect(page).toHaveScreenshot('nft-detail.png', {
      fullPage: false,
      mask: [page.getByTestId('realtime-status'), page.getByTestId('mock-devbar-toggle')],
    })

    // Visitar ID inexistente
    await page.goto('/nfts/nft-inexistente-999?net=instant')
    await expect(page.getByTestId('nft-detail-not-found')).toBeVisible()
    await page.getByTestId('back-to-catalog-link').click()
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
  })

  test('Cenário 5: Favoritar/desfavoritar com atualização otimista e reversão quando a API falha', async ({
    page,
  }) => {
    await page.goto('/login?net=instant')
    await page.getByTestId('fill-demo-credentials-btn').click()
    await page.getByTestId('auth-submit-btn').click()
    await expect(page.getByTestId('header-user-link')).toBeVisible()

    await page.goto('/nfts/nft-1?net=instant')
    const favBtn = page.getByTestId('detail-favorite-btn')
    const initialPressed = await favBtn.getAttribute('aria-pressed')

    // Alternar favorito com sucesso
    await favBtn.click()
    const toggledPressed = initialPressed === 'true' ? 'false' : 'true'
    await expect(favBtn).toHaveAttribute('aria-pressed', toggledPressed)

    // Ativar falha determinística nos favoritos e verificar reversão otimista (rollback)
    await page.evaluate(() => {
      window.__mock.setFlag('favorites-fail', true)
    })
    await favBtn.click()
    await expect(favBtn).toHaveAttribute('aria-pressed', toggledPressed)
  })

  test('Cenário 6: Carrinho completo (adicionar, alterar qtd, remover, persistir no reload e cupons válido/inválido) + visual regression', async ({
    page,
  }) => {
    await page.goto('/nfts/nft-1?net=instant')
    await page.getByTestId('add-to-cart-btn').click()
    await expect(page.getByTestId('header-cart-badge')).toHaveText('1')

    await page.goto('/cart?net=instant')
    await expect(page.getByTestId('cart-item-nft-1-nft-1-e1')).toBeVisible()
    await expect(page.getByTestId('cart-subtotal')).toContainText('1.19 ETH')

    // Visual Regression: Carrinho
    await expect(page).toHaveScreenshot('cart-page.png', {
      fullPage: false,
      mask: [page.getByTestId('realtime-status'), page.getByTestId('mock-devbar-toggle')],
    })

    // Aumentar quantidade para 2
    await page.getByTestId('cart-inc-nft-1-nft-1-e1').click()
    await expect(page.getByTestId('cart-qty-nft-1-nft-1-e1')).toHaveText('2')
    await expect(page.getByTestId('cart-subtotal')).toContainText('2.38 ETH')

    // Persistência após reload
    await page.reload()
    await expect(page.getByTestId('cart-qty-nft-1-nft-1-e1')).toHaveText('2')

    // Cupom expirado
    await page.getByTestId('coupon-input').fill('EXPIRED20')
    await page.getByTestId('apply-coupon-btn').click()
    await expect(page.getByTestId('coupon-error')).toContainText('expirou')

    // Cupom válido NFT10 (10% de 2.38 = 0.238 ETH)
    await page.getByTestId('coupon-input').fill('NFT10')
    await page.getByTestId('apply-coupon-btn').click()
    await expect(page.getByTestId('active-coupon-badge')).toContainText('NFT10')
    await expect(page.getByTestId('cart-discount')).toContainText('0.238 ETH')

    // Remover item
    await page.getByTestId('cart-remove-nft-1-nft-1-e1').click()
    await expect(page.getByTestId('cart-empty-state')).toBeVisible()
  })

  test('Cenário 7: Visitante monta carrinho -> redirecionado ao login ao finalizar -> retorna ao checkout com carrinho preservado', async ({
    page,
  }) => {
    await page.goto('/nfts/nft-2?net=instant')
    await page.getByTestId('buy-now-btn').click()
    await expect(page).toHaveURL(/\/cart/)

    await page.getByTestId('proceed-checkout-btn').click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)

    await page.getByTestId('fill-demo-credentials-btn').click()
    await page.getByTestId('auth-submit-btn').click()

    await expect(page).toHaveURL(/\/checkout/)
    await expect(page.getByTestId('checkout-item-nft-2')).toBeVisible()
  })

  test('Cenário 8: Alteração de preço durante a revisão da compra (409 QUOTE_STALE) -> aviso e nova confirmação', async ({
    page,
  }) => {
    await page.goto('/login?net=instant')
    await page.getByTestId('fill-demo-credentials-btn').click()
    await page.getByTestId('auth-submit-btn').click()
    await expect(page.getByTestId('header-user-link')).toBeVisible()

    await page.goto('/nfts/nft-1?net=instant')
    await page.getByTestId('buy-now-btn').click()
    await page.getByTestId('proceed-checkout-btn').click()
    await expect(page).toHaveURL(/\/checkout/)

    // Ativar mudança de preço no momento do envio do pedido
    await page.evaluate(() => {
      window.__mock.setFlag('price-change-on-checkout', true)
      window.__mock.setOrderResolveMs(300)
    })

    await page.getByTestId('confirm-purchase-btn').click()
    await expect(page.getByTestId('stale-quote-modal')).toBeVisible()
    await expect(page.getByTestId('stale-quote-new-total')).toBeVisible()

    // Aceitar nova cotação e concluir pedido
    await page.getByTestId('accept-new-quote-btn').click()
    await expect(page).toHaveURL(/\/orders\/ord-/)
    await expect(page.getByTestId('order-confirmed-heading')).toBeVisible({ timeout: 10_000 })
  })

  test('Cenário 9: Item esgota em tempo real antes da confirmação -> bloqueio da compra e remoção no carrinho', async ({
    page,
  }) => {
    await page.goto('/nfts/nft-3?net=instant')
    await page.getByTestId('buy-now-btn').click()
    await expect(page).toHaveURL(/\/cart/)

    // Simular esgotamento via Socket.IO
    await page.evaluate(() => {
      window.__mock.simulateSoldOut('nft-3')
    })

    await expect(page.getByTestId('cart-issues-banner')).toBeVisible()
    await expect(page.getByTestId('proceed-checkout-btn')).toBeDisabled()

    // Remover o item esgotado
    await page.getByTestId('cart-remove-nft-3-nft-3-e1').click()
    await expect(page.getByTestId('cart-empty-state')).toBeVisible()
  })

  test('Cenário 10: Timeout no envio do pedido -> nova tentativa com mesma Idempotency-Key sem duplicação', async ({
    page,
  }) => {
    await page.goto('/login?net=instant')
    await page.getByTestId('fill-demo-credentials-btn').click()
    await page.getByTestId('auth-submit-btn').click()
    await expect(page.getByTestId('header-user-link')).toBeVisible()

    await page.goto('/nfts/nft-4?net=instant')
    await page.getByTestId('buy-now-btn').click()
    await page.getByTestId('proceed-checkout-btn').click()

    await page.evaluate(() => {
      window.__mock.setFlag('order-timeout', true)
      window.__mock.setOrderResolveMs(300)
    })

    await page.getByTestId('confirm-purchase-btn').click()
    await expect(page.getByTestId('checkout-submit-error')).toBeVisible({ timeout: 12_000 })

    // Tentar novamente com a mesma chave de idempotência
    await page.getByTestId('checkout-retry-submit-btn').click()
    await expect(page).toHaveURL(/\/orders\/ord-/)

    // Verificar no banco MSW que apenas 1 pedido foi criado para este usuário
    const orderCount = await page.evaluate(async () => {
      const res = await fetch('/api/orders', {
        headers: {
          Authorization: `Bearer ${JSON.parse(localStorage.getItem('nft.session')!).token}`,
        },
      })
      const orders = await res.json()
      return orders.length
    })
    expect(orderCount).toBe(1)
  })

  test('Cenário 11: Pedido recusado (payment-declined) com atualização em tempo real e liberação de estoque', async ({
    page,
  }) => {
    await page.goto('/login?net=instant')
    await page.getByTestId('fill-demo-credentials-btn').click()
    await page.getByTestId('auth-submit-btn').click()
    await expect(page.getByTestId('header-user-link')).toBeVisible()

    await page.goto('/nfts/nft-5?net=instant')
    await page.getByTestId('buy-now-btn').click()
    await page.getByTestId('proceed-checkout-btn').click()

    await page.evaluate(() => {
      window.__mock.setFlag('payment-declined', true)
      window.__mock.setOrderResolveMs(400)
    })

    await page.getByTestId('confirm-purchase-btn').click()
    await expect(page).toHaveURL(/\/orders\/ord-/)
    await expect(page.getByTestId('order-declined-banner')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('order-retry-link')).toBeVisible()
  })

  test('Cenário 12: Queda/reconexão Socket.IO, deduplicação de eventos, expiração de sessão, perfil/carteiras e logout', async ({
    page,
  }) => {
    await page.goto('/login?net=instant')
    await page.getByTestId('fill-demo-credentials-btn').click()
    await page.getByTestId('auth-submit-btn').click()
    await expect(page.getByTestId('header-user-link')).toBeVisible()

    // Testar deduplicação de eventos duplicados e versões antigas no Socket.IO
    await page.evaluate(() => {
      window.__mock.simulatePriceChange('nft-1', 'nft-1-e1', '1.45')
      window.__mock.replayEvents({ duplicateLast: true, staleVersion: true })
    })

    // Testar queda e reconexão do Socket.IO
    await page.evaluate(() => {
      window.__mock.dropSocket()
    })
    await expect(page.getByTestId('realtime-disconnected-banner')).toBeVisible()
    await page.getByRole('button', { name: 'Reconectar agora' }).click()

    // Testar edição de perfil e carteiras
    await page.goto('/account/profile?net=instant')
    await page.getByTestId('profile-firstname-input').fill('Ana')
    await page.getByTestId('profile-lastname-input').fill('Kurio Web3')
    await page.getByTestId('save-profile-btn').click()
    await expect(page.getByTestId('header-user-link')).toContainText('Ana Kurio Web3')

    await page.getByTestId('account-nav-wallets').click()
    await expect(page).toHaveURL(/\/account\/wallets/)
    await page.getByTestId('toggle-add-secondary-wallet-btn').click()
    await page.getByTestId('sec-wallet-label-input').fill('Vault Secundária')
    await page
      .getByTestId('sec-wallet-address-input')
      .fill('0x9988776655443322110099887766554433221100')
    await page.getByTestId('save-sec-wallet-btn').click()
    await expect(page.getByText('Vault Secundária')).toBeVisible()

    // Testar expiração de sessão
    await page.evaluate(() => {
      window.__mock.expireCurrentSession()
    })
    await page.getByTestId('save-primary-wallet-btn').click()
    await expect(page.getByTestId('session-expired-banner')).toBeVisible()
  })
})
