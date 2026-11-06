/**
 * Simulação de condições de rede para os handlers MSW.
 * Latência determinística (PRNG semeado) para cenários reproduzíveis.
 */
import { delay, HttpResponse } from 'msw'
import { prng } from './fixtures'
import { getConfig, onConfigChange } from './config'

let rand = prng(getConfig().seed)
let outOfOrderCounter = 0
onConfigChange((c) => {
  rand = prng(c.seed)
  outOfOrderCounter = 0
})

/**
 * Aplica latência/falha de rede conforme o perfil ativo.
 * Retorna uma Response de erro de rede quando a requisição deve falhar,
 * ou `undefined` para seguir com o handler.
 */
export async function simulateNetwork(opts: { outOfOrder?: boolean } = {}): Promise<Response | undefined> {
  const { network } = getConfig()
  switch (network) {
    case 'instant':
      return
    case 'normal':
      await delay(120 + Math.floor(rand() * 280))
      return
    case 'slow':
      await delay(2500)
      return
    case 'variable':
      await delay(100 + Math.floor(rand() * 1900))
      return
    case 'out-of-order': {
      if (opts.outOfOrder) {
        // Requisições mais antigas demoram mais: as respostas chegam invertidas.
        const n = outOfOrderCounter++
        await delay(Math.max(150, 1800 - n * 600))
      } else {
        await delay(150)
      }
      return
    }
    case 'offline':
      return HttpResponse.error()
    case 'timeout':
      await delay('infinite')
      return
  }
}

