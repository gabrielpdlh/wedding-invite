import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { formatBRL } from "@/lib/money";
import { PixStatus } from "./pix-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagamento via Pix | Nosso Casamento",
  robots: { index: false, follow: false },
};

export default async function PixPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // O id entra direto num WHERE de coluna uuid: sem esta guarda, uma URL
  // inventada viraria erro de sintaxe do Postgres em vez de um 404.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const contribution = await db.query.contributions.findFirst({
    where: { id },
    with: { gift: true },
  });

  if (!contribution) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <header className="text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            Pagamento via Pix
          </p>
          <p className="mt-3 font-serif text-4xl">
            {formatBRL(contribution.amountCents)}
          </p>
          <p className="mt-1 text-sm text-muted">{contribution.gift.name}</p>
        </header>

        <hr className="my-6 border-border" />

        <PixStatus
          contributionId={contribution.id}
          initialStatus={contribution.status}
          giftSlug={contribution.gift.slug}
          qrCode={contribution.pixQrCode}
          qrCodeBase64={contribution.pixQrCodeBase64}
          expiresAt={contribution.expiresAt?.toISOString() ?? null}
        />
      </div>
    </main>
  );
}
