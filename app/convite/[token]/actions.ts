"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import { guests, invites } from "@/db/schema";
import { sendRsvpNotification } from "@/lib/email";

export type RsvpState = { error?: string };

export async function confirmRsvp(
  _prev: RsvpState,
  formData: FormData,
): Promise<RsvpState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "Convite inválido." };

  const invite = await db.query.invites.findFirst({
    where: { token },
    with: { guests: true },
  });

  if (!invite) return { error: "Convite não encontrado." };
  if (invite.respondedAt) {
    return { error: "Esta resposta já foi enviada e não pode ser alterada." };
  }

  // Checkbox names are the guest ids; unchecked boxes simply aren't submitted.
  const attendingIds = new Set(
    formData.getAll("attending").map((value) => String(value)),
  );
  const validAttendingIds = invite.guests
    .map((guest) => guest.id)
    .filter((id) => attendingIds.has(id));

  const lockedInvite = await db.transaction(async (tx) => {
    // Claim the lock first: only succeeds while respondedAt is still NULL, so
    // two concurrent submits can't both write.
    const [locked] = await tx
      .update(invites)
      .set({ respondedAt: new Date() })
      .where(and(eq(invites.id, invite.id), isNull(invites.respondedAt)))
      .returning({ id: invites.id });

    if (!locked) return null;

    await tx
      .update(guests)
      .set({ attending: false })
      .where(eq(guests.inviteId, invite.id));

    if (validAttendingIds.length > 0) {
      await tx
        .update(guests)
        .set({ attending: true })
        .where(inArray(guests.id, validAttendingIds));
    }

    return locked;
  });

  if (!lockedInvite) {
    return { error: "Esta resposta já foi enviada e não pode ser alterada." };
  }

  const mainGuest = invite.guests.find((guest) => guest.isMain);

  // Email is best-effort — sendRsvpNotification swallows its own errors.
  await sendRsvpNotification({
    mainGuestName: mainGuest?.name ?? "Convidado",
    guests: invite.guests.map((guest) => ({
      name: guest.name,
      attending: validAttendingIds.includes(guest.id),
    })),
    inviteId: invite.id,
  });

  revalidatePath(`/convite/${token}`);
  revalidatePath("/admin");
  return {};
}
