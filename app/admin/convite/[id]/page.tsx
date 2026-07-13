import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireAdmin } from "@/lib/session";
import { deleteInvite } from "../../actions";
import { CopyLink } from "../../copy-link";

export default async function InviteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const invite = await db.query.invites.findFirst({
    where: { id },
    with: { guests: true },
  });

  if (!invite) notFound();

  const main = invite.guests.find((guest) => guest.isMain);
  const ordered = invite.guests.toSorted(
    (a, b) => Number(b.isMain) - Number(a.isMain),
  );

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">
        ← Voltar
      </Link>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">{main?.name ?? "Convite"}</h1>
        <CopyLink token={invite.token} />
      </header>

      <p className="mt-2 text-sm text-muted">
        {invite.respondedAt
          ? `Respondido em ${invite.respondedAt.toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}`
          : "Ainda não respondeu."}
      </p>

      {invite.message && (
        <blockquote className="mt-6 border-l-2 border-accent/40 pl-4 font-serif text-lg italic text-foreground/80">
          {invite.message}
        </blockquote>
      )}

      <ul className="mt-8 space-y-2">
        {ordered.map((guest) => (
          <li
            key={guest.id}
            className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
          >
            <span>
              {guest.name}
              {guest.isMain && (
                <span className="ml-2 text-xs uppercase tracking-wide text-muted">
                  principal
                </span>
              )}
            </span>
            <span className="text-sm text-muted">
              {!invite.respondedAt ? "—" : guest.attending ? "✅" : "❌"}
            </span>
          </li>
        ))}
      </ul>

      <form action={deleteInvite} className="mt-10">
        <input type="hidden" name="id" value={invite.id} />
        <button
          type="submit"
          className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
        >
          Deletar convite
        </button>
      </form>
    </main>
  );
}
