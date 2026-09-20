"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contributions, type ContributionMethod } from "@/db/schema";
import { getGiftWithProgress, isFunded } from "@/lib/gifts";
import { createCardPreference, createPixCharge } from "@/lib/mercadopago";
import { formatBRL, parseAmountToCents } from "@/lib/money";
import {
  MAX_CONTRIBUTION_CENTS,
  MAX_SHARES,
  MIN_CONTRIBUTION_CENTS,
} from "@/lib/contribution";

export type ContributeState = { error?: string };

export async function startContribution(
  _prev: ContributeState,
  formData: FormData,
): Promise<ContributeState> {
  const slug = String(formData.get("slug") ?? "");
  const gift = await getGiftWithProgress(slug);
  if (!gift || !gift.active) return { error: "Presente não encontrado." };
  if (isFunded(gift)) {
    return { error: "Este presente já foi presenteado por completo. 🎉" };
  }

  const donorName = String(formData.get("donorName") ?? "").trim();
  if (!donorName) {
    return {
      error: "Escreva seu nome para os noivos saberem quem presenteou.",
    };
  }

  const method = String(formData.get("method") ?? "");
  if (method !== "pix" && method !== "card") {
    return { error: "Escolha entre Pix e cartão." };
  }

  // Uma server action é um endpoint POST público, alcançável sem passar pela
  // tela. Por isso o formulário só diz QUANTAS cotas — o preço da cota vem do
  // banco, e o valor livre é revalidado contra os limites aqui.
  const amountCents = resolveAmountCents(formData, gift.shareCents);
  if (!amountCents) return { error: "Informe um valor válido." };
  if (amountCents < MIN_CONTRIBUTION_CENTS) {
    return { error: `O valor mínimo é ${formatBRL(MIN_CONTRIBUTION_CENTS)}.` };
  }
  if (amountCents > MAX_CONTRIBUTION_CENTS) {
    return {
      error: `Para valores acima de ${formatBRL(MAX_CONTRIBUTION_CENTS)}, fale direto com os noivos.`,
    };
  }

  const donorEmail =
    String(formData.get("donorEmail") ?? "")
      .trim()
      .toLowerCase() || null;
  const message = String(formData.get("message") ?? "").trim() || null;

  const [contribution] = await db
    .insert(contributions)
    .values({
      giftId: gift.id,
      donorName,
      donorEmail,
      message,
      amountCents,
      method: method as ContributionMethod,
      status: "pending",
    })
    .returning({ id: contributions.id });

  let destination: string;

  try {
    if (method === "pix") {
      const charge = await createPixCharge({
        contributionId: contribution.id,
        amountCents,
        description: `Presente de casamento — ${gift.name}`,
        payerEmail: donorEmail ?? fallbackPayerEmail(),
      });

      await db
        .update(contributions)
        .set({
          providerRef: charge.orderId,
          pixQrCode: charge.qrCode,
          pixQrCodeBase64: charge.qrCodeBase64,
          expiresAt: charge.expiresAt,
        })
        .where(eq(contributions.id, contribution.id));

      destination = `/presentes/pix/${contribution.id}`;
    } else {
      const preference = await createCardPreference({
        contributionId: contribution.id,
        amountCents,
        title: `Presente de casamento — ${gift.name}`,
        payerEmail: donorEmail ?? undefined,
      });

      await db
        .update(contributions)
        .set({ providerRef: preference.preferenceId })
        .where(eq(contributions.id, contribution.id));

      destination = preference.initPoint;
    }
  } catch (error) {
    console.error("[presentes] falha ao criar a cobrança:", error);
    // Sem isto sobraria uma linha `pending` órfã que nunca vira nada e suja o
    // painel sem explicar o motivo.
    await db
      .update(contributions)
      .set({ status: "failed", providerStatus: "erro ao criar cobrança" })
      .where(eq(contributions.id, contribution.id));

    return {
      error:
        "Não conseguimos abrir o pagamento agora. Tente de novo em alguns instantes.",
    };
  }

  // `redirect` lança uma exceção de controle: se ficasse dentro do try acima,
  // o catch a trataria como falha e marcaria a contribuição como `failed`.
  redirect(destination);
}

function resolveAmountCents(formData: FormData, shareCents: number) {
  const shares = Number(formData.get("shares"));
  if (Number.isInteger(shares) && shares > 0 && shares <= MAX_SHARES) {
    return shares * shareCents;
  }

  const custom = String(formData.get("customAmount") ?? "").trim();
  return custom ? parseAmountToCents(custom) : null;
}

/**
 * A Orders API exige um email do pagador, mas pedir email ao convidado só
 * acrescenta atrito. Quem não informa cai neste endereço — o recibo do Mercado
 * Pago vai para os noivos em vez de se perder.
 */
function fallbackPayerEmail() {
  const admin = process.env.ADMIN_EMAIL?.split(",")[0]?.trim();
  return admin || "convidado@exemplo.com";
}
