import Big from 'big.js'
import type { EthAmount } from './api/contracts'

// Aritmética decimal exata para ETH. Nunca usar Number para valores monetários.
Big.DP = 18
Big.RM = Big.roundHalfEven

export const ETH_DECIMALS = 18

export function eth(value: EthAmount | number | Big): Big {
  return new Big(value)
}

export function add(...values: EthAmount[]): EthAmount {
  return values.reduce((acc, v) => acc.plus(v), new Big(0)).toFixed()
}

export function sub(a: EthAmount, b: EthAmount): EthAmount {
  return new Big(a).minus(b).toFixed()
}

export function mul(a: EthAmount, qty: number | string): EthAmount {
  return new Big(a).times(qty).toFixed()
}

/** Percentual com arredondamento para baixo (a favor do cliente) em 18 casas */
export function percentOf(a: EthAmount, percent: number): EthAmount {
  return new Big(a).times(percent).div(100).round(ETH_DECIMALS, Big.roundDown).toFixed()
}

export function cmp(a: EthAmount, b: EthAmount): -1 | 0 | 1 {
  return new Big(a).cmp(b) as -1 | 0 | 1
}

export function isValidEth(value: string): boolean {
  if (!/^\d+(\.\d{1,18})?$/.test(value.trim())) return false
  return true
}

/**
 * Formata para exibição: até `maxDecimals` casas, sem zeros à direita.
 * Arredonda para baixo apenas na apresentação; cálculos usam o valor completo.
 */
export function formatEth(
  value: EthAmount,
  optsOrDecimals: number | { withSymbol?: boolean; maxDecimals?: number } = 4,
): string {
  const maxDecimals =
    typeof optsOrDecimals === 'number' ? optsOrDecimals : (optsOrDecimals.maxDecimals ?? 4)
  const withSymbol =
    typeof optsOrDecimals === 'object' ? Boolean(optsOrDecimals.withSymbol) : false
  const b = new Big(value || '0')
  let s = b.round(maxDecimals, Big.roundHalfUp).toFixed(maxDecimals)
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  if (s === '0' && !b.eq(0)) s = `< 0.${'0'.repeat(maxDecimals - 1)}1`
  return withSymbol ? `${s} ETH` : s
}

export function formatEthLabel(value: EthAmount, maxDecimals = 4): string {
  return `${formatEth(value, maxDecimals)} ETH`
}
