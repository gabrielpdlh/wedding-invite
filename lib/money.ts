/**
 * Dinheiro trafega em centavos (integer) no banco inteiro — nunca float. A
 * conversão para/de decimal acontece só nas bordas: a tela e a API do Mercado Pago.
 */

export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** O Mercado Pago quer string decimal de 2 casas nos campos de order: 90000 → "900.00". */
export function centsToAmountString(cents: number) {
  return (cents / 100).toFixed(2);
}

/** "900.00" ou 900 → 90000. `round` porque 9.99 * 100 dá 998.9999… em float. */
export function amountToCents(amount: string | number) {
  return Math.round(Number(amount) * 100);
}

/**
 * Lê o que o convidado digitou no campo de valor livre. Aceita "100", "1.234,56",
 * "1234.56" e "R$ 90". Devolve null quando não dá para ler um número.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized: string;
  if (lastComma > lastDot) {
    // "1.234,56" — vírgula manda, ponto é separador de milhar.
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // "1,234.56" → decimal; mas "1.234" (3 dígitos, sem vírgula) é milhar em pt-BR.
    const decimals = cleaned.length - lastDot - 1;
    normalized =
      decimals === 3 && lastComma === -1
        ? cleaned.replace(/\./g, "")
        : cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}
