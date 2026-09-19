"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { gifts } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { formatBRL, parseAmountToCents } from "@/lib/money";
import { reconcilePendingContributions } from "@/lib/reconcile";

export type GiftFormState = { error?: string; created?: string };

const MIN_SHARE_CENTS = 1_000; // R$ 10

export async function createGift(
  _prev: GiftFormState,
  formData: FormData,
): Promise<GiftFormState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Dê um nome ao presente." };

  const targetCents = parseAmountToCents(String(formData.get("target") ?? ""));
  if (!targetCents) return { error: "Informe a meta do presente." };

  const shareCents = parseAmountToCents(String(formData.get("share") ?? ""));
  if (!shareCents) return { error: "Informe o valor da cota." };
  if (shareCents < MIN_SHARE_CENTS) {
    return { error: "A cota mínima é R$ 10,00." };
  }
  if (shareCents > targetCents) {
    return { error: "A cota não pode ser maior que a meta." };
  }

  const description = String(formData.get("description") ?? "").trim() || null;
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;

  await db.insert(gifts).values({
    slug: await uniqueSlug(name),
    name,
    description,
    imageUrl,
    targetCents,
    shareCents,
  });

  revalidatePath("/admin/presentes");
  return { created: name };
}

export async function toggleGift(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db
    .update(gifts)
    .set({ active: sql`not ${gifts.active}` })
    .where(eq(gifts.id, id));

  revalidatePath("/admin/presentes");
}

export async function deleteGift(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  try {
    await db.delete(gifts).where(eq(gifts.id, id));
  } catch {
    // `contributions.giftId` é ON DELETE RESTRICT: um presente que já recebeu
    // dinheiro não pode sumir e levar o histórico junto. Desative em vez disso.
    revalidatePath("/admin/presentes");
    return;
  }

  revalidatePath("/admin/presentes");
}

/**
 * "Jogo de Panelas Tramontina" → "jogo-de-panelas-tramontina", com sufixo
 * numérico se já existir. O slug é a URL pública, então tem que ser estável e
 * único.
 */
async function uniqueSlug(name: string) {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "presente";

  const taken = new Set(
    (await db.select({ slug: gifts.slug }).from(gifts)).map((row) => row.slug),
  );

  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function updateGift(
  _prev: GiftFormState,
  formData: FormData,
): Promise<GiftFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Presente não identificado." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "O nome não pode ficar vazio." };

  const targetCents = parseAmountToCents(String(formData.get("target") ?? ""));
  if (!targetCents) return { error: "Meta inválida." };

  const shareCents = parseAmountToCents(String(formData.get("share") ?? ""));
  if (!shareCents) return { error: "Valor de cota inválido." };
  if (shareCents < MIN_SHARE_CENTS)
    return { error: "A cota mínima é R$ 10,00." };
  if (shareCents > targetCents) {
    return { error: "A cota não pode ser maior que a meta." };
  }

  // O `slug` de propósito não muda: ele já pode estar em link compartilhado no
  // WhatsApp da família. Renomear o presente não deve quebrar esses links.
  await db
    .update(gifts)
    .set({
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      imageUrl: String(formData.get("imageUrl") ?? "").trim() || null,
      targetCents,
      shareCents,
    })
    .where(eq(gifts.id, id));

  revalidatePath("/admin/presentes");
  return { created: name };
}

export type ReconcileState = { summary?: string; error?: string };

/**
 * Pergunta ao Mercado Pago o status real de tudo que ficou pendente e acerta o
 * banco. Existe como botão do painel (e não só como script) porque o token de
 * produção vive nas variáveis da Vercel — daqui a consulta roda com ele, sem o
 * token precisar sair de lá.
 */
export async function reconcileNow(
  _prev: ReconcileState,
  _formData: FormData,
): Promise<ReconcileState> {
  await requireAdmin();

  try {
    const linhas = await reconcilePendingContributions();

    if (linhas.length === 0) {
      revalidatePath("/admin/presentes");
      return { summary: "Nada pendente — está tudo em dia." };
    }

    const creditadas = linhas.filter((l) => l.outcome === "creditada");
    const erros = linhas.filter((l) => l.outcome === "erro");
    const total = creditadas.reduce((soma, l) => soma + l.amountCents, 0);

    const partes = [
      creditadas.length > 0
        ? `${creditadas.length} creditada(s), ${formatBRL(total)}`
        : "nenhuma nova confirmação",
      `${linhas.length} pendente(s) conferida(s)`,
    ];
    if (erros.length > 0)
      partes.push(`${erros.length} com erro: ${erros[0].detail}`);

    revalidatePath("/admin/presentes");
    return { summary: partes.join(" · ") };
  } catch (error) {
    console.error("[admin] reconciliação falhou:", error);
    return {
      error:
        error instanceof Error
          ? error.message.slice(0, 200)
          : "Falha ao consultar o Mercado Pago.",
    };
  }
}
