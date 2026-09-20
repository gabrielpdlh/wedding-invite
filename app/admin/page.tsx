import Link from "next/link";
import { db } from "@/db";
import { requireAdmin } from "@/lib/session";
import { CopyLink } from "./copy-link";
import { CopyGuestList } from "./copy-guest-list";
import { SignOutButton } from "./sign-out-button";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const { tab } = await searchParams;
  const view = tab === "pessoas" || tab === "confirmados" ? tab : "convites";

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
        <h1 className="font-serif text-3xl">Painel</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/presentes"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            Presentes
          </Link>
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
        <Stat label="Confirmadas" value={totals.attending} />
        <Stat label="Convites sem resposta" value={totals.pending} />
      </section>

      <nav className="mt-8 flex gap-1 border-b border-border">
        <Tab href="/admin" active={view === "convites"}>
          Convites ({totals.invites})
        </Tab>
        <Tab href="/admin?tab=confirmados" active={view === "confirmados"}>
          Confirmados ({totals.attending})
        </Tab>
        <Tab href="/admin?tab=pessoas" active={view === "pessoas"}>
          Pessoas ({totals.people})
        </Tab>
      </nav>

      {view === "confirmados" ? (
        <ConfirmedList invites={allInvites} />
      ) : view === "pessoas" ? (
        <PeopleList invites={allInvites} />
      ) : (
        <InviteList invites={allInvites} />
      )}
    </main>
  );
}

type InviteWithGuests = {
  id: string;
  token: string;
  respondedAt: Date | null;
  guests: { id: string; name: string; isMain: boolean; attending: boolean }[];
};

function ConfirmedList({ invites }: { invites: InviteWithGuests[] }) {
  // Só convites já respondidos: num convite sem resposta todo mundo está
  // `attending: false`, o que quer dizer "ainda não disse", não "não vem".
  // Contar esses como recusa inflaria a lista de ausentes.
  const familias = invites
    .filter((invite) => invite.respondedAt)
    .map((invite) => ({
      id: invite.id,
      familia:
        invite.guests.find((guest) => guest.isMain)?.name ?? "Sem principal",
      indo: invite.guests.filter((guest) => guest.attending),
    }))
    .filter((grupo) => grupo.indo.length > 0)
    // Alfabética, não por data de resposta: essa lista serve para procurar um
    // nome específico.
    .sort((a, b) => a.familia.localeCompare(b.familia, "pt-BR"));

  const nomes = familias
    .flatMap((grupo) => grupo.indo.map((guest) => guest.name))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (nomes.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
        Ninguém confirmou ainda.
      </p>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm text-emerald-800">
          <strong>{nomes.length}</strong>{" "}
          {nomes.length === 1 ? "pessoa confirmada" : "pessoas confirmadas"} em{" "}
          {familias.length} {familias.length === 1 ? "convite" : "convites"}
        </p>
        <CopyGuestList names={nomes} />
      </div>

      <ul className="mt-3 space-y-2">
        {familias.map((grupo) => (
          <li
            key={grupo.id}
            className="rounded-xl border border-border bg-card px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/admin/convite/${grupo.id}`}
                className="truncate text-xs text-muted hover:text-accent"
              >
                convite de {grupo.familia}
              </Link>
              <span className="shrink-0 text-xs text-muted">
                {grupo.indo.length}{" "}
                {grupo.indo.length === 1 ? "pessoa" : "pessoas"}
              </span>
            </div>
            <ul className="mt-1.5 space-y-1">
              {grupo.indo.map((guest) => (
                <li key={guest.id} className="text-[15px]">
                  <span aria-hidden>✅</span> {guest.name}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PeopleList({ invites }: { invites: InviteWithGuests[] }) {
  // Flatten every guest, keeping which family they came from. Main guest first
  // within each invite so the list reads as "família por família".
  const rows = invites.flatMap((invite) => {
    const family =
      invite.guests.find((guest) => guest.isMain)?.name ?? "Sem principal";
    return [...invite.guests]
      .sort((a, b) => Number(b.isMain) - Number(a.isMain))
      .map((guest) => ({
        ...guest,
        family,
        inviteId: invite.id,
        responded: invite.respondedAt !== null,
      }));
  });

  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
        Nenhuma pessoa cadastrada ainda.
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            <Link
              href={`/admin/convite/${row.inviteId}`}
              className="truncate text-xs text-muted hover:text-accent"
            >
              {row.isMain ? "convite próprio" : `convite de ${row.family}`}
            </Link>
          </div>
          <GuestStatus responded={row.responded} attending={row.attending} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Three states, not two: `attending: false` on an invite nobody answered yet
 * means "hasn't replied", not "declined".
 */
function GuestStatus({
  responded,
  attending,
}: {
  responded: boolean;
  attending: boolean;
}) {
  if (!responded) {
    return (
      <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        Aguardando
      </span>
    );
  }
  return attending ? (
    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      ✅ Vai
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
      ❌ Não vai
    </span>
  );
}

function InviteList({ invites }: { invites: InviteWithGuests[] }) {
  if (invites.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
        Nenhum convite ainda. Crie o primeiro!
      </p>
    );
  }

  return (
    <section className="mt-6 space-y-3">
      {invites.map((invite) => {
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
                  {invite.respondedAt &&
                    ` · ${attending} de ${invite.guests.length} confirmada(s)`}
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
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-accent text-accent-deep"
          : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="font-serif text-3xl">{value}</p>
      <p className="mt-0.5 text-xs leading-tight text-muted">{label}</p>
    </div>
  );
}
