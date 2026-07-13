"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { guests, invites } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

export type CreateInviteState = {
  error?: string;
  token?: string;
};

export async function createInvite(
  _prev: CreateInviteState,
  formData: FormData,
): Promise<CreateInviteState> {
  const session = await requireAdmin();

  const mainName = String(formData.get("mainName") ?? "").trim();
  if (!mainName) {
    return { error: "O nome do convidado principal é obrigatório." };
  }

  const companions = formData
    .getAll("companion")
    .map((value) => String(value).trim())
    .filter(Boolean);

  const message = String(formData.get("message") ?? "").trim();
  const token = nanoid(10);

  await db.transaction(async (tx) => {
    const [invite] = await tx
      .insert(invites)
      .values({
        token,
        createdBy: session.user.id,
        message: message || null,
      })
      .returning({ id: invites.id });

    await tx.insert(guests).values([
      { inviteId: invite.id, name: mainName, isMain: true },
      ...companions.map((name) => ({ inviteId: invite.id, name })),
    ]);
  });

  revalidatePath("/admin");
  return { token };
}

export async function deleteInvite(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // guests cascade on delete
  await db.delete(invites).where(eq(invites.id, id));

  revalidatePath("/admin");
  redirect("/admin");
}
