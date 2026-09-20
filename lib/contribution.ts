/**
 * Limites de uma contribuição, em centavos.
 *
 * Vivem fora de `app/presentes/[slug]/actions.ts` porque um arquivo `"use server"`
 * só pode exportar função assíncrona — e a tela precisa ler o mínimo para anunciar
 * o mesmo número que o servidor vai cobrar. Uma fonte só, sem dois valores para
 * sair de sincronia.
 *
 * `CONTRIBUTION_MIN_CENTS` existe apenas para baixar o mínimo durante um teste em
 * produção. Apagar a variável devolve o padrão seguro sozinho.
 */
export const MIN_CONTRIBUTION_CENTS =
  Number(process.env.CONTRIBUTION_MIN_CENTS) || 2_000;

export const MAX_CONTRIBUTION_CENTS = 2_000_000;

export const MAX_SHARES = 50;
