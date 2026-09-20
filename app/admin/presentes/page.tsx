import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdmin } from "@/lib/session";
import { listGiftsWithProgress, isFunded } from "@/lib/gifts";
import { formatBRL } from "@/lib/money";
import { ProgressBar } from "@/app/presentes/progress";
import { paymentEvents, type ContributionStatus } from "@/db/schema";
import { GiftForm } from "./gift-form";
import { GiftEditForm } from "./edit-form";
import { ReconcileButton } from "./reconcile-button";
import { deleteGift, toggleGift } from "./actions";

export default async function AdminGiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const { tab } = await searchParams;
  const view =
    tab === "contribuicoes" || tab === "webhooks" ? tab : "presentes";

  const gifts = await listGiftsWithProgress({ includeInactive: true });
  const contributions = await db.query.contributions.findMany({
    with: { gift: true },
    orderBy: { createdAt: "desc" },
    limit: 200,
  });

  // Log cru dos webhooks: é o que responde "paguei e não apareceu" sem precisar
  // de acesso ao banco nem aos logs da Vercel.
  const eventos = await db.query.paymentEvents.findMany({
    orderBy: { receivedAt: "desc" },
    limit: 50,
  });
  // Só as recentes acendem o alerta: contar o histórico inteiro manteria o aviso
  // vermelho aceso para sempre por causa de um problema já resolvido, e alarme
  // que nunca apaga é alarme que ninguém lê. O histórico completo continua na
  // aba Webhooks.
  //
  // A janela é calculada no Postgres, não em JS: `Date.now()` durante o render é
  // função impura (o React reclama, com razão), e assim o corte usa o relógio do
  // banco — o mesmo que gravou as linhas.
  const [{ rejeitados }] = await db
    .select({ rejeitados: sql<number>`count(*)::int` })
    .from(paymentEvents)
    .where(
      and(
        eq(paymentEvents.signatureOk, false),
        sql`${paymentEvents.receivedAt} > now() - interval '24 hours'`,
      ),
    );

  const paid = contributions.filter((row) => row.status === "paid");
  const totals = {
    raised: paid.reduce((sum, row) => sum + row.amountCents, 0),
    gifts: gifts.length,
    confirmed: paid.length,
    pending: contributions.filter((row) => row.status === "pending").length,
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-muted hover:text-accent">
            ← Painel
          </Link>
          <h1 className="mt-1 font-serif text-3xl">Presentes</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <ReconcileButton />
            <Link
              href="/presentes"
              target="_blank"
              className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent"
            >
              Ver lista pública
            </Link>
          </div>
        </div>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Arrecadado" value={formatBRL(totals.raised)} />
        <Stat label="Presentes" value={String(totals.gifts)} />
        <Stat label="Confirmadas" value={String(totals.confirmed)} />
        <Stat label="Pendentes" value={String(totals.pending)} />
      </section>

      {rejeitados > 0 && (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {rejeitados} webhook(s) recusado(s) por assinatura nas últimas 24h.
          Pagamentos podem ter entrado no Mercado Pago sem aparecer aqui —
          clique em <strong>Conferir pagamentos</strong> e veja a aba Webhooks.
        </p>
      )}

      <nav className="mt-8 flex gap-1 border-b border-border">
        <Tab href="/admin/presentes" active={view === "presentes"}>
          Presentes ({totals.gifts})
        </Tab>
        <Tab
          href="/admin/presentes?tab=contribuicoes"
          active={view === "contribuicoes"}
        >
          Contribuições ({contributions.length})
        </Tab>
        <Tab href="/admin/presentes?tab=webhooks" active={view === "webhooks"}>
          Webhooks ({eventos.length})
        </Tab>
      </nav>

      {view === "contribuicoes" ? (
        <ContributionList rows={contributions} />
      ) : view === "webhooks" ? (
        <EventList rows={eventos} />
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {gifts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
                Nenhum presente cadastrado. Crie o primeiro abaixo.
              </p>
            ) : (
              gifts.map((gift) => <GiftRow key={gift.id} gift={gift} />)
            )}
          </div>

          <div className="mt-8">
            <GiftForm />
          </div>
        </>
      )}
    </main>
  );
}

function GiftRow({
  gift,
}: {
  gift: Awaited<ReturnType<typeof listGiftsWithProgress>>[number];
}) {
  const funded = isFunded(gift);

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{gift.name}</h3>
            {!gift.active && (
              <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs text-muted">
                oculto
              </span>
            )}
            {funded && (
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                completo
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {formatBRL(gift.raisedCents)} de {formatBRL(gift.targetCents)} ·
            cota de {formatBRL(gift.shareCents)} · {gift.supporters}{" "}
            {gift.supporters === 1 ? "contribuição" : "contribuições"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <form action={toggleGift}>
            <input type="hidden" name="id" value={gift.id} />
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent hover:text-accent"
            >
              {gift.active ? "Ocultar" : "Mostrar"}
            </button>
          </form>

          {/* Só aparece enquanto ninguém contribuiu: depois disso o banco
              recusa o delete (ON DELETE RESTRICT) e o caminho é ocultar. */}
          {gift.supporters === 0 && gift.raisedCents === 0 && (
            <form action={deleteGift}>
              <input type="hidden" name="id" value={gift.id} />
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-red-300 hover:text-red-600"
              >
                Excluir
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar gift={gift} />
      </div>

      <p className="mt-2 truncate font-mono text-xs text-muted">
        /presentes/{gift.slug}
      </p>

      <GiftEditForm gift={gift} />
    </article>
  );
}

function EventList({
  rows,
}: {
  rows: Array<{
    id: string;
    topic: string;
    action: string | null;
    signatureOk: boolean;
    note: string | null;
    resourceId: string | null;
    receivedAt: Date;
  }>;
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
        Nenhum webhook recebido ainda. Se um pagamento já foi feito, a URL no
        painel do Mercado Pago provavelmente não está apontando para cá.
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className={`rounded-xl border px-4 py-3 ${
            row.signatureOk
              ? "border-border bg-card"
              : "border-red-200 bg-red-50"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate font-mono text-xs">
              {row.topic} · {row.action ?? "—"}
            </p>
            <span className="shrink-0 text-xs text-muted">
              {row.receivedAt.toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {row.resourceId && (
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
              {row.resourceId}
            </p>
          )}
          {row.note && (
            <p
              className={`mt-1 text-xs leading-relaxed ${
                row.signatureOk ? "text-muted" : "text-red-700"
              }`}
            >
              {row.note}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function ContributionList({
  rows,
}: {
  rows: Array<{
    id: string;
    donorName: string;
    amountCents: number;
    method: string;
    status: ContributionStatus;
    createdAt: Date;
    message: string | null;
    gift: { name: string };
  }>;
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
        Nenhuma contribuição ainda.
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.donorName} · {formatBRL(row.amountCents)}
            </p>
            <p className="truncate text-xs text-muted">
              {row.gift.name} · {row.method === "pix" ? "Pix" : "cartão"} ·{" "}
              {row.createdAt.toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {row.message && (
              <p className="mt-1 text-sm italic text-muted">“{row.message}”</p>
            )}
          </div>
          <StatusBadge status={row.status} />
        </li>
      ))}
    </ul>
  );
}

const STATUS_STYLES: Record<
  ContributionStatus,
  { label: string; className: string }
> = {
  paid: {
    label: "✅ Pago",
    className: "bg-emerald-50 text-emerald-700",
  },
  pending: { label: "Aguardando", className: "bg-amber-50 text-amber-700" },
  expired: { label: "Expirou", className: "bg-background text-muted" },
  failed: { label: "Recusado", className: "bg-red-50 text-red-700" },
  refunded: { label: "Estornado", className: "bg-red-50 text-red-700" },
};

function StatusBadge({ status }: { status: ContributionStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="font-serif text-2xl">{value}</p>
      <p className="mt-0.5 text-xs leading-tight text-muted">{label}</p>
    </div>
  );
}
