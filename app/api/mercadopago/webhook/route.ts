import { after } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { contributions, paymentEvents } from "@/db/schema";
import {
  getOrder,
  getPayment,
  resolveOrder,
  resolvePayment,
  verifyWebhookSignature,
  MercadoPagoApiError,
  type ResolvedPayment,
} from "@/lib/mercadopago";
import { sendGiftNotification } from "@/lib/email";
import { formatBRL } from "@/lib/money";

/**
 * Webhook do Mercado Pago — o único lugar do sistema que credita dinheiro.
 *
 * Dois tópicos chegam aqui: `order` (Pix, via Orders API) e o legado `payment`
 * (cartão, via Checkout Pro). Os dois são resolvidos relendo o recurso pela API;
 * o corpo da notificação nunca é tratado como fonte de verdade, porque quem
 * consegue forjar um POST conseguiria escolher o próprio status.
 *
 * O Mercado Pago espera 200/201 em até 22s e retenta a cada 15 min enquanto não
 * receber — repetição é o comportamento normal, não a exceção.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const url = new URL(request.url);
  const queryDataId =
    url.searchParams.get("data.id") ?? url.searchParams.get("id");

  const body = await request.json().catch(() => null);
  const bodyDataId = body?.data?.id ? String(body.data.id) : null;
  const topic = String(
    body?.type ?? url.searchParams.get("type") ?? "desconhecido",
  );
  const resourceId = String(bodyDataId ?? queryDataId ?? "");
  const action = body?.action ? String(body.action) : null;

  const base = { topic, resourceId: resourceId || null, action, payload: body };

  const signature = verifyWebhookSignature({
    dataIdFromQuery: queryDataId,
    dataIdFromBody: bodyDataId,
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
  });

  if (!signature.ok) {
    // Guardamos o formato da requisição junto do motivo: sem isso, diagnosticar
    // uma rejeição vira adivinhação sobre o que o Mercado Pago mandou.
    await log({
      ...base,
      signatureOk: false,
      note: [
        signature.reason,
        `query="${url.search || "(vazia)"}"`,
        `x-request-id=${request.headers.get("x-request-id") ?? "AUSENTE"}`,
        `x-signature=${request.headers.get("x-signature") ?? "AUSENTE"}`,
        `body.data.id=${bodyDataId ?? "ausente"}`,
      ].join(" | "),
    });
    return new Response("assinatura inválida", { status: 401 });
  }

  if (!resourceId) {
    await log({ ...base, signatureOk: true, note: "notificação sem data.id" });
    return ok();
  }

  try {
    let resolved: ResolvedPayment;

    if (topic === "order") {
      resolved = resolveOrder(await getOrder(resourceId));
    } else if (topic === "payment") {
      resolved = resolvePayment(await getPayment(resourceId));
    } else {
      await log({
        ...base,
        signatureOk: true,
        note: `tópico ignorado: ${topic}`,
      });
      return ok();
    }

    const reference = resolved.externalReference;
    if (!reference || !UUID.test(reference)) {
      await log({
        ...base,
        signatureOk: true,
        note: `external_reference fora do formato esperado: ${reference ?? "vazio"}`,
      });
      return ok();
    }

    const contribution = await db.query.contributions.findFirst({
      where: { id: reference },
      with: { gift: true },
    });

    if (!contribution) {
      // 200 de propósito: um 4xx/5xx faria o Mercado Pago retentar para sempre
      // algo que nunca vai resolver. Fica registrado em `payment_events`.
      await log({
        ...base,
        signatureOk: true,
        note: `nenhuma contribuição com id ${reference}`,
      });
      return ok();
    }

    const notes: string[] = [];
    if (
      resolved.paidCents != null &&
      resolved.paidCents !== contribution.amountCents
    ) {
      notes.push(
        `valor divergente: cobrado ${contribution.amountCents}, pago ${resolved.paidCents}`,
      );
    }

    if (resolved.status === "paid") {
      // Mesmo lock do RSVP em app/convite/[token]/actions.ts: a transição só
      // acontece se a linha ainda não estava paga, então reprocessar a mesma
      // notificação não soma nada duas vezes.
      const [promoted] = await db
        .update(contributions)
        .set({
          status: "paid",
          paidAt: new Date(),
          providerStatus: resolved.providerStatus,
          providerRef: resourceId,
        })
        .where(
          and(
            eq(contributions.id, contribution.id),
            ne(contributions.status, "paid"),
          ),
        )
        .returning({ id: contributions.id });

      notes.push(promoted ? "confirmada" : "já estava paga (reprocessamento)");

      if (promoted) {
        // Fora do caminho da resposta: se o Resend travar, o Mercado Pago não
        // pode ficar esperando e acabar retentando a notificação.
        after(() =>
          sendGiftNotification({
            giftName: contribution.gift.name,
            donorName: contribution.donorName,
            amount: formatBRL(contribution.amountCents),
            message: contribution.message,
          }),
        );
      }
    } else if (resolved.status === "refunded") {
      // Estorno vale mesmo sobre uma linha já paga — o dinheiro voltou e precisa
      // sair do total.
      await db
        .update(contributions)
        .set({ status: "refunded", providerStatus: resolved.providerStatus })
        .where(eq(contributions.id, contribution.id));
      notes.push("estornada");
    } else if (resolved.status === "expired" || resolved.status === "failed") {
      // Só derruba o que ainda estava pendente: uma notificação atrasada não
      // pode desfazer um pagamento confirmado.
      await db
        .update(contributions)
        .set({
          status: resolved.status,
          providerStatus: resolved.providerStatus,
        })
        .where(
          and(
            eq(contributions.id, contribution.id),
            eq(contributions.status, "pending"),
          ),
        );
      notes.push(resolved.status);
    } else {
      // Pix emitido e ainda não pago (`action_required` / `waiting_transfer`).
      notes.push(`ainda pendente (${resolved.providerStatus})`);
    }

    await log({
      ...base,
      signatureOk: true,
      contributionId: contribution.id,
      note: `[assinatura: ${signature.variant}] ${notes.join(" · ")}`,
    });

    return ok();
  } catch (error) {
    // 4xx sobre o recurso = a notificação nunca vai ser processável. É o caso
    // da "Simular notificação" do painel, que manda `data.id: "123456"` e leva
    // um 400 `invalid_path_param`. Devolver 500 faria o Mercado Pago retentar
    // de 15 em 15 minutos, para sempre, algo que jamais vai resolver.
    if (error instanceof MercadoPagoApiError && error.isPermanent) {
      await log({
        ...base,
        signatureOk: true,
        note: `assinatura OK ✓ — mas o recurso ${resourceId} não é consultável (HTTP ${error.status}). Simulação do painel, ou credencial de outro ambiente.`,
      });
      return ok();
    }

    console.error("[webhook] falha ao processar notificação:", error);
    await log({
      ...base,
      signatureOk: true,
      note: `erro: ${error instanceof Error ? error.message : String(error)}`,
    }).catch(() => {});
    // 500 de propósito: aqui o Mercado Pago DEVE retentar.
    return new Response("erro ao processar", { status: 500 });
  }
}

function ok() {
  return new Response("ok", { status: 200 });
}

async function log(entry: {
  topic: string;
  resourceId: string | null;
  action: string | null;
  signatureOk: boolean;
  note?: string;
  contributionId?: string;
  payload: unknown;
}) {
  try {
    await db.insert(paymentEvents).values({
      topic: entry.topic,
      resourceId: entry.resourceId,
      action: entry.action,
      signatureOk: entry.signatureOk,
      note: entry.note ?? null,
      contributionId: entry.contributionId ?? null,
      payload: entry.payload ?? null,
    });
  } catch (error) {
    console.error("[webhook] não consegui gravar payment_events:", error);
  }
}
