"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { gifts } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { parseAmountToCents } from "@/lib/money";

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
