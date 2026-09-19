import { Resend } from "resend";

type RsvpGuest = { name: string; attending: boolean };

/**
 * Notifies the couple that a family confirmed. Never throws: the database is the
 * source of truth, so a failed email must not roll back an RSVP.
 */
export async function sendRsvpNotification(params: {
  mainGuestName: string;
  guests: RsvpGuest[];
  inviteId: string;
}) {
  const { mainGuestName, guests, inviteId } = params;

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_EMAIL;
  // `||`, not `??`: RESEND_FROM is usually present-but-empty in .env, and an
  // empty From is rejected by Resend.
  const from = process.env.RESEND_FROM || "Convites <onboarding@resend.dev>";

  if (!apiKey || !to) {
    console.warn(
      "[email] RESEND_API_KEY ou ADMIN_EMAIL ausente — pulando notificação de RSVP.",
    );
    return;
  }

  const going = guests.filter((g) => g.attending);
  const notGoing = guests.filter((g) => !g.attending);
  const adminUrl = `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/admin/convite/${inviteId}`;

  const list = guests
    .map((g) => `<li>${g.attending ? "✅" : "❌"} ${escapeHtml(g.name)}</li>`)
    .join("");

  const resend = new Resend(apiKey);
  const recipients = to
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

  const email = {
    from,
    subject: `✅ ${mainGuestName} confirmou presença`,
    html: `
      <h2>${escapeHtml(mainGuestName)} respondeu ao convite</h2>
      <p><strong>${going.length}</strong> confirmado(s), <strong>${notGoing.length}</strong> ausente(s).</p>
      <ul>${list}</ul>
      <p><a href="${adminUrl}">Ver no painel</a></p>
    `,
  };

  // One send per recipient: Resend rejects the whole call if a single address is
  // not allowed (e.g. before a domain is verified), which would silently drop
  // the notification for everyone.
  await Promise.all(
    recipients.map(async (recipient) => {
      try {
        const { error } = await resend.emails.send({
          ...email,
          to: [recipient],
        });
        if (error) {
          console.error(
            `[email] Falha ao enviar para ${recipient}:`,
            error.message,
          );
        }
      } catch (error) {
        console.error(`[email] Falha ao enviar para ${recipient}:`, error);
      }
    }),
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Avisa os noivos que uma contribuição foi confirmada. Como a de RSVP, nunca
 * lança: o webhook já gravou o pagamento e um email falhando não pode virar um
 * 500 que faça o Mercado Pago retentar a notificação.
 */
export async function sendGiftNotification(params: {
  giftName: string;
  donorName: string;
  amount: string;
  message: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_EMAIL;
  const from = process.env.RESEND_FROM || "Convites <onboarding@resend.dev>";

  if (!apiKey || !to) {
    console.warn(
      "[email] RESEND_API_KEY ou ADMIN_EMAIL ausente — pulando aviso de presente.",
    );
    return;
  }

  const adminUrl = `${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/admin/presentes`;
  const resend = new Resend(apiKey);
  const recipients = to
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

  const email = {
    from,
    subject: `🎁 ${params.donorName} contribuiu com ${params.amount}`,
    html: `
      <h2>${escapeHtml(params.donorName)} presenteou vocês!</h2>
      <p><strong>${escapeHtml(params.amount)}</strong> para <strong>${escapeHtml(params.giftName)}</strong>.</p>
      ${params.message ? `<blockquote>${escapeHtml(params.message)}</blockquote>` : ""}
      <p><a href="${adminUrl}">Ver no painel</a></p>
    `,
  };

  await Promise.all(
    recipients.map(async (recipient) => {
      try {
        const { error } = await resend.emails.send({
          ...email,
          to: [recipient],
        });
        if (error) {
          console.error(
            `[email] Falha ao enviar para ${recipient}:`,
            error.message,
          );
        }
      } catch (error) {
        console.error(`[email] Falha ao enviar para ${recipient}:`, error);
      }
    }),
  );
}
