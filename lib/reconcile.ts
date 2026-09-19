import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { contributions, paymentEvents } from "@/db/schema";
import {
  getOrder,
  getPayment,
  resolveOrder,
  resolvePayment,
} from "./mercadopago";

export type ReconcileRow = {
  id: string;
  gift: string;
  amountCents: number;
  outcome: "creditada" | "ja-paga" | "pendente" | "erro";
  detail: string;
};

/**
 * Rede de segurança do webhook: relê no Mercado Pago o status real de toda
 * contribuição parada em `pending` e acerta o banco.
 *
 * O webhook continua sendo o caminho normal. Isto existe para quando ele falha —
 * segredo de outro ambiente, deploy fora do ar, URL trocada no painel — e para o
 * caso, raro mas real, de uma notificação simplesmente não chegar.
 *
 * Usa a mesma transição travada do webhook (`ne(status, "paid")`), então rodar
 * duas vezes não credita duas vezes.
 */
export async function reconcilePendingContributions(): Promise<ReconcileRow[]> {
  const pendentes = await db.query.contributions.findMany({
    where: { status: "pending" },
    with: { gift: true },
    orderBy: { createdAt: "desc" },
  });

  const resultados: ReconcileRow[] = [];

  for (const c of pendentes) {
    const base = { id: c.id, gift: c.gift.name, amountCents: c.amountCents };

    if (!c.providerRef) {
      resultados.push({
        ...base,
        outcome: "erro",
        detail: "sem cobrança criada",
      });
      continue;
    }

    // Orders da API nova têm id `ORD…`. No cartão guardamos o id da preference,
    // que não é consultável como pagamento — esse só o webhook resolve.
    const ehOrder = c.providerRef.startsWith("ORD");
    if (!ehOrder && c.method === "card") {
      resultados.push({
        ...base,
        outcome: "pendente",
        detail: "cartão: só o webhook confirma",
      });
      continue;
    }

    try {
      const resolved = ehOrder
        ? resolveOrder(await getOrder(c.providerRef))
        : resolvePayment(await getPayment(c.providerRef));

      if (resolved.status === "paid") {
        const [promovida] = await db
          .update(contributions)
          .set({
            status: "paid",
            paidAt: new Date(),
            providerStatus: resolved.providerStatus,
          })
          .where(
            and(eq(contributions.id, c.id), ne(contributions.status, "paid")),
          )
          .returning({ id: contributions.id });

        await db.insert(paymentEvents).values({
          topic: ehOrder ? "order" : "payment",
          resourceId: c.providerRef,
          action: "reconcile",
          signatureOk: true,
          note: promovida
            ? "creditada pela reconciliação (webhook não entregou)"
            : "já estava paga",
          contributionId: c.id,
          payload: null,
        });

        resultados.push({
          ...base,
          outcome: promovida ? "creditada" : "ja-paga",
          detail: resolved.providerStatus,
        });
      } else {
        // Se o Mercado Pago diz que expirou ou falhou, tira de `pending` para o
        // painel não acumular lixo — o total já ignorava essas linhas.
        if (resolved.status === "expired" || resolved.status === "failed") {
          await db
            .update(contributions)
            .set({
              status: resolved.status,
              providerStatus: resolved.providerStatus,
            })
            .where(
              and(
                eq(contributions.id, c.id),
                eq(contributions.status, "pending"),
              ),
            );
        }
        resultados.push({
          ...base,
          outcome: "pendente",
          detail: resolved.providerStatus,
        });
      }
    } catch (error) {
      resultados.push({
        ...base,
        outcome: "erro",
        detail:
          error instanceof Error ? error.message.slice(0, 160) : String(error),
      });
    }
  }

  return resultados;
}
