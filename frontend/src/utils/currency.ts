const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  CZK: 'Kč',
  JPY: '¥',
  CNY: '¥',
  AUD: 'A$',
  CAD: 'C$',
}

/** Convert a currency code (e.g. "EUR") to its symbol (e.g. "€").
 *  Falls back to the code itself for unrecognized currencies. */
export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code
}
