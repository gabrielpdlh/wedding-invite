import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contributions, gifts } from "@/db/schema";

/**
 * Leitura dos presentes com o quanto já foi arrecadado.
 *
 * O total é sempre `SUM(amount_cents) FILTER (WHERE status = 'paid')` — nunca uma
 * coluna denormalizada. Contribuição `pending` não reserva nem aparece: enquanto
 * o webhook não confirmar, aquele dinheiro não existe.
 */

const raisedCents = sql<number>`coalesce(sum(${contributions.amountCents}) filter (where ${contributions.status} = 'paid'), 0)::int`;

const supporters = sql<number>`(count(${contributions.id}) filter (where ${contributions.status} = 'paid'))::int`;

const giftColumns = {
  id: gifts.id,
  slug: gifts.slug,
  name: gifts.name,
  description: gifts.description,
  imageUrl: gifts.imageUrl,
  targetCents: gifts.targetCents,
  shareCents: gifts.shareCents,
  active: gifts.active,
  sortOrder: gifts.sortOrder,
};

export type GiftWithProgress = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  targetCents: number;
  shareCents: number;
  active: boolean;
  sortOrder: number;
  raisedCents: number;
  supporters: number;
};

export async function listGiftsWithProgress(
  options: { includeInactive?: boolean } = {},
): Promise<GiftWithProgress[]> {
  const query = db
    .select({ ...giftColumns, raisedCents, supporters })
    .from(gifts)
    // LEFT JOIN, não INNER: presente sem nenhuma contribuição ainda precisa
    // aparecer na lista, zerado.
    .leftJoin(contributions, eq(contributions.giftId, gifts.id))
    .groupBy(gifts.id)
    .orderBy(asc(gifts.sortOrder), asc(gifts.createdAt));

  return options.includeInactive
    ? await query
    : await query.where(eq(gifts.active, true));
}

export async function getGiftWithProgress(
  slug: string,
): Promise<GiftWithProgress | null> {
  const [row] = await db
    .select({ ...giftColumns, raisedCents, supporters })
    .from(gifts)
    .leftJoin(contributions, eq(contributions.giftId, gifts.id))
    .where(eq(gifts.slug, slug))
    .groupBy(gifts.id)
    .limit(1);

  return row ?? null;
}

export function remainingCents(gift: {
  targetCents: number;
  raisedCents: number;
}) {
  return Math.max(0, gift.targetCents - gift.raisedCents);
}

export function isFunded(gift: { targetCents: number; raisedCents: number }) {
  return gift.raisedCents >= gift.targetCents;
}

/** 0–100, arredondado, sem passar de 100 mesmo se alguém der a mais. */
export function progressPercent(gift: {
  targetCents: number;
  raisedCents: number;
}) {
  if (gift.targetCents <= 0) return 0;
  return Math.min(100, Math.round((gift.raisedCents / gift.targetCents) * 100));
}
