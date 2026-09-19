import Link from "next/link";
import type { Metadata } from "next";
import { listGiftsWithProgress, isFunded } from "@/lib/gifts";
import { formatBRL } from "@/lib/money";
import { WEDDING } from "@/lib/wedding";
import { ProgressBar, ProgressLabel } from "./progress";
import { Photo, PhotoPlaceholder } from "./photo";

// Os valores mudam quando o webhook confirma um pagamento. Renderizar a cada
// visita é mais barato (e muito menos sujeito a bug) do que orquestrar
// invalidação de cache numa página que um casamento inteiro acessa algumas
// centenas de vezes.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Lista de presentes | ${WEDDING.couple}`,
  description:
    "Ajude a montar nosso lar. Cada presente é uma vaquinha — contribua com o quanto quiser, por Pix ou cartão.",
};

/**
 * Enquadramentos escolhidos olhando cada foto: numa delas o casal está à
 * esquerda, nas outras ao centro com os rostos no terço superior. Sem isso o
 * corte automático decapita todo mundo no celular.
 */
const GALERIA = [
  { src: "/DSC_0073.jpg", alt: "Os noivos abraçados", position: "center 30%" },
  {
    src: "/DSC_1785.jpg",
    alt: "Os noivos na praia ao pôr do sol",
    position: "center 32%",
  },
  {
    src: "/DSC_0011.jpg",
    alt: "Os noivos no arco de pedra",
    position: "38% center",
  },
];

export default async function GiftsPage() {
  const gifts = await listGiftsWithProgress();
  const available = gifts.filter((gift) => !isFunded(gift));
  const completed = gifts.filter(isFunded);

  return (
    <>
      <header className="relative h-[68vh] min-h-[420px] w-full overflow-hidden">
        <Photo
          src="/hero.jpg"
          alt="Os noivos"
          sizes="100vw"
          priority
          // Os rostos ficam a ~28% da altura; centralizar cortaria as cabeças
          // nas telas mais largas.
          objectPosition="center 38%"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/70" />

        <div className="relative flex h-full flex-col items-center justify-end px-5 pb-12 text-center text-white">
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/80">
            Nosso casamento
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-none drop-shadow-sm sm:text-6xl">
            {WEDDING.couple}
          </h1>
          <p className="mt-4 text-sm text-white/90">
            {WEDDING.date} · {WEDDING.venue}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-14">
        <section className="text-center">
          <h2 className="font-serif text-3xl sm:text-4xl">
            Lista de presentes
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted">
            Em vez de uma lista de loja, escolhemos uma vaquinha: cada presente
            tem um valor e várias pessoas podem contribuir com um pedacinho.
            Qualquer quantia ajuda — e a sua presença já é o maior presente.
          </p>
        </section>

        {gifts.length === 0 ? (
          <p className="mt-12 rounded-xl border border-dashed border-border px-5 py-12 text-center text-sm text-muted">
            A lista ainda está sendo preparada. Volte em breve!
          </p>
        ) : (
          <>
            <section className="mt-10 grid gap-5 sm:grid-cols-2">
              {available.map((gift) => (
                <GiftCard key={gift.id} gift={gift} />
              ))}
            </section>

            {completed.length > 0 && (
              <section className="mt-14">
                <h2 className="text-center font-serif text-2xl">
                  Já presenteados 🎉
                </h2>
                <p className="mt-1 text-center text-sm text-muted">
                  Obrigado a quem tornou estes possíveis!
                </p>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  {completed.map((gift) => (
                    <GiftCard key={gift.id} gift={gift} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <section aria-label="Fotos do casal" className="px-5 pb-14">
        <div className="mx-auto grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          {GALERIA.map((foto) => (
            <div
              key={foto.src}
              className="relative aspect-[4/3] overflow-hidden rounded-2xl"
            >
              <Photo
                src={foto.src}
                alt={foto.alt}
                sizes="(max-width: 640px) 92vw, 300px"
                objectPosition={foto.position}
              />
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-card/60 px-5 py-12 text-center">
        <p className="font-serif text-2xl">{WEDDING.couple}</p>
        <p className="mt-3 text-[15px]">
          <span aria-hidden>📅</span> {WEDDING.date}, {WEDDING.time}
        </p>
        <p className="mt-2 text-[15px]">
          <span aria-hidden>📍</span> {WEDDING.venue}
        </p>
        <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-muted">
          {WEDDING.address}
        </p>

        <p className="mt-8 text-xs text-muted">
          Pagamentos processados pelo Mercado Pago · Pix ou cartão de crédito
        </p>
        <Link
          href="/admin"
          className="mt-4 inline-block text-xs text-muted underline underline-offset-4 hover:text-accent"
        >
          Área dos noivos
        </Link>
      </footer>
    </>
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
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {gift.imageUrl ? (
          <Photo
            src={gift.imageUrl}
            alt={gift.name}
            sizes="(max-width: 640px) 92vw, 340px"
          />
        ) : (
          <PhotoPlaceholder />
        )}
        {funded && (
          <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow">
            Presenteado
          </span>
        )}
      </div>

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
