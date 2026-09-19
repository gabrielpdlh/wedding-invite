import "dotenv/config";
import { reconcilePendingContributions } from "@/lib/reconcile";
import { formatBRL } from "@/lib/money";

/**
 * Versão de linha de comando da reconciliação. Precisa do MERCADOPAGO_ACCESS_TOKEN
 * do MESMO ambiente que criou as cobranças — para as de produção, use o botão
 * "Conferir pagamentos" em /admin/presentes, que já roda com o token da Vercel.
 *
 *   npm run gifts:reconcile
 */
const ICONE = {
  creditada: "✅",
  "ja-paga": "  ",
  pendente: "⏳",
  erro: "⚠️ ",
} as const;

async function main() {
  const linhas = await reconcilePendingContributions();

  if (linhas.length === 0) {
    console.log("Nenhuma contribuição pendente.");
    process.exit(0);
  }

  for (const linha of linhas) {
    console.log(
      `${ICONE[linha.outcome]} ${linha.outcome.padEnd(9)} ${formatBRL(linha.amountCents).padStart(11)} · ${linha.gift} — ${linha.detail}`,
    );
  }

  const creditadas = linhas.filter((l) => l.outcome === "creditada").length;
  console.log(`\n${creditadas} creditada(s) de ${linhas.length} pendente(s).`);
  process.exit(0);
}

main();
