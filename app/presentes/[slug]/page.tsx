import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getGiftWithProgress,
  isFunded,
  listSupporters,
  remainingCents,
} from "@/lib/gifts";
import { ProgressBar, ProgressLabel } from "../progress";
import { ContributeForm } from "./contribute-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const gift = await getGiftWithProgress(slug);
  if (!gift) return { title: "Presente não encontrado" };

  return {
    title: `${gift.name} | Lista de presentes`,
    description:
      gift.description ??
      `Contribua com ${gift.name} na lista de presentes do nosso casamento.`,
  };
}

export default async function GiftPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const gift = await getGiftWithProgress(slug);
  if (!gift || !gift.active) notFound();

  const supporters = await listSupporters(gift.id);
  const funded = isFunded(gift);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <Link
        href="/presentes"
        className="text-sm text-muted transition-colors hover:text-accent"
      >
        ← Todos os presentes
      </Link>

      <article className="mt-5 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        {gift.imageUrl && (
          // Mesma razão da lista, em app/presentes/page.tsx.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gift.imageUrl}
            alt=""
            className="h-52 w-full object-cover"
          />
        )}

        <div className="space-y-5 p-6 sm:p-8">
          <header>
            <h1 className="font-serif text-3xl leading-tight">{gift.name}</h1>
            {gift.description && (
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {gift.description}
              </p>
            )}
          </header>

          <div className="space-y-2">
            <ProgressBar gift={gift} />
            <ProgressLabel gift={gift} />
            {supporters.length > 0 && (
              <p className="text-xs text-muted">
                {supporters.length}{" "}
                {supporters.length === 1
                  ? "pessoa já contribuiu"
                  : "pessoas já contribuíram"}
              </p>
            )}
          </div>

          <hr className="border-border" />

          {funded ? (
            <section className="space-y-4 text-center">
              <p className="font-serif text-2xl">Este já foi presenteado! 🎉</p>
              <p className="text-sm leading-relaxed text-muted">
                Obrigado a todos que contribuíram. Ainda dá para ajudar com os
                outros itens da lista.
              </p>
              <Link
                href="/presentes"
                className="inline-block rounded-xl bg-accent-deep px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Ver outros presentes
              </Link>
            </section>
          ) : (
            <ContributeForm
              slug={gift.slug}
              shareCents={gift.shareCents}
              remainingCents={remainingCents(gift)}
            />
          )}
        </div>
      </article>

      {supporters.length > 0 && (
        <section className="mt-8">
          <h2 className="font-serif text-2xl">Quem já ajudou</h2>
          <ul className="mt-4 space-y-2">
            {supporters.map((supporter) => (
              <li
                key={supporter.id}
                className="rounded-xl border border-border bg-card px-4 py-3"
              >
                <p className="text-[15px] font-medium">{supporter.donorName}</p>
                {supporter.message && (
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    “{supporter.message}”
                  </p>
                )}
              </li>
            ))}
          </ul>
          {/* Valores individuais ficam de fora de propósito: quem deu uma cota
              não precisa aparecer ao lado de quem deu dez. */}
        </section>
      )}
    </main>
  );
}
