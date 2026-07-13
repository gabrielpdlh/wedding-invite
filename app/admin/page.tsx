import Link from "next/link";
import { db } from "@/db";
import { requireAdmin } from "@/lib/session";
import { CopyLink } from "./copy-link";
import { SignOutButton } from "./sign-out-button";

export default async function AdminPage() {
  await requireAdmin();

  const allInvites = await db.query.invites.findMany({
    with: { guests: true },
    orderBy: { createdAt: "desc" },
  });

  const allGuests = allInvites.flatMap((invite) => invite.guests);
  const totals = {
    invites: allInvites.length,
    people: allGuests.length,
    attending: allGuests.filter((guest) => guest.attending).length,
    pending: allInvites.filter((invite) => !invite.respondedAt).length,
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-3xl">Convites</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/novo"
            className="rounded-lg bg-accent-deep px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Novo convite
          </Link>
          <SignOutButton />
        </div>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Convites" value={totals.invites} />
        <Stat label="Pessoas convidadas" value={totals.people} />
        <Stat label="Confirmados" value={totals.attending} />
        <Stat label="Sem resposta" value={totals.pending} />
      </section>

      <section className="mt-8 space-y-3">
        {allInvites.length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
            Nenhum convite ainda. Crie o primeiro!
          </p>
        )}

        {allInvites.map((invite) => {
          const main = invite.guests.find((guest) => guest.isMain);
          const attending = invite.guests.filter(
            (guest) => guest.attending,
          ).length;

          return (
            <article
              key={invite.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/admin/convite/${invite.id}`}
                    className="font-medium hover:text-accent"
                  >
                    {main?.name ?? "Sem convidado principal"}
                  </Link>
                  <p className="mt-0.5 text-sm text-muted">
                    {invite.guests.length}{" "}
                    {invite.guests.length === 1 ? "pessoa" : "pessoas"}
                    {invite.respondedAt && ` · ${attending} confirmada(s)`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {invite.respondedAt ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      Respondido
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      Aguardando
                    </span>
                  )}
                  <CopyLink token={invite.token} />
                </div>
              </div>

              <p className="mt-3 truncate font-mono text-xs text-muted">
                /convite/{invite.token}
              </p>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="font-serif text-3xl">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}
