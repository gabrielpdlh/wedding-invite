import Link from "next/link";
import type { Metadata } from "next";
import { listGiftsWithProgress, isFunded } from "@/lib/gifts";
import { formatBRL } from "@/lib/money";
import { ProgressBar, ProgressLabel } from "./progress";

// Os valores mudam quando o webhook confirma um pagamento. Renderizar a cada
// visita é mais barato (e muito menos sujeito a bug) do que orquestrar
// invalidação de cache para uma página que um casamento inteiro acessa algumas
// centenas de vezes.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lista de presentes | Nosso Casamento",
  description: "Ajude a montar nosso lar contribuindo com um presente.",
};

export default async function GiftsPage() {
  const gifts = await listGiftsWithProgress();
  const available = gifts.filter((gift) => !isFunded(gift));
  const completed = gifts.filter(isFunded);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">
          Nosso casamento
        </p>
        <h1 className="mt-4 font-serif text-4xl">Lista de presentes</h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted">
          Em vez de uma lista de loja, escolhemos uma vaquinha: cada presente
          tem um valor e várias pessoas podem contribuir com um pedacinho.
          Qualquer quantia ajuda — e a sua presença já é o maior presente.
        </p>
      </header>

      {gifts.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-border px-5 py-12 text-center text-sm text-muted">
          A lista ainda está sendo preparada. Volte em breve!
        </p>
      ) : (
        <>
          <section className="mt-10 grid gap-4 sm:grid-cols-2">
            {available.map((gift) => (
              <GiftCard key={gift.id} gift={gift} />
            ))}
          </section>

          {completed.length > 0 && (
            <section className="mt-12">
              <h2 className="font-serif text-2xl">Já presenteados 🎉</h2>
              <p className="mt-1 text-sm text-muted">
                Obrigado a quem tornou estes possíveis!
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {completed.map((gift) => (
                  <GiftCard key={gift.id} gift={gift} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <p className="mt-14 text-center text-xs text-muted">
        Pagamentos processados pelo Mercado Pago. Pix ou cartão de crédito.
      </p>
    </main>
  );
}

function GiftCard({
  gift,
}: {
  gift: Awaited<ReturnType<typeof listGiftsWithProgress>>[number];
}) {
  const funded = isFunded(gift);

  return (
    <Link
      href={`/presentes/${gift.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-accent"
    >
      {gift.imageUrl && (
        // URL arbitrária cadastrada pelos noivos no painel: usar next/image
        // exigiria liberar o domínio em next.config a cada presente novo.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gift.imageUrl}
          alt=""
          className="h-40 w-full object-cover"
          loading="lazy"
        />
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex-1">
          <h3 className="font-serif text-xl leading-tight">{gift.name}</h3>
          {gift.description && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">
              {gift.description}
            </p>
          )}
        </div>

        <ProgressBar gift={gift} />
        <ProgressLabel gift={gift} />

        <span
          className={`mt-1 text-sm font-medium ${
            funded ? "text-muted" : "text-accent-deep group-hover:underline"
          }`}
        >
          {funded
            ? `${gift.supporters} ${gift.supporters === 1 ? "pessoa contribuiu" : "pessoas contribuíram"}`
            : `Contribuir a partir de ${formatBRL(gift.shareCents)} →`}
        </span>
      </div>
    </Link>
  );
}
