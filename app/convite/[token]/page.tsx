import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { WEDDING } from "@/lib/wedding";
import { RsvpForm } from "./rsvp-form";
import { ThankYouModal } from "./thank-you-modal";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ obrigado?: string }>;
}) {
  const { token } = await params;
  const { obrigado } = await searchParams;

  const invite = await db.query.invites.findFirst({
    where: { token },
    with: { guests: true },
  });

  if (!invite) notFound();

  const main = invite.guests.find((guest) => guest.isMain);
  const companions = invite.guests.filter((guest) => !guest.isMain);
  const responded = invite.respondedAt !== null;
  const going = invite.guests.filter((guest) => guest.attending);

  // Main guest first, companions after — stable order for the checkbox list.
  const ordered = main ? [main, ...companions] : companions;

  return (
    <>
      {responded && obrigado === "1" && (
        <ThankYouModal going={going.map((guest) => guest.name)} token={token} />
      )}

      {/* next/image (not a CSS background) so the 7.5MB original gets resized
          and served as WebP — most guests open this on mobile data. */}
      <div className="fixed inset-0 -z-10">
        <Image
          src="/bg-imagem.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-white/55 backdrop-blur-[3px]" />
      </div>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
        <div className="overflow-hidden rounded-3xl border border-white/60 bg-card/92 shadow-xl shadow-black/10 backdrop-blur-md">
          {/* The couple sits low and centered in the source photo, so the crop is
              pulled down to keep them in frame. */}
          <div className="relative h-44 w-full sm:h-52">
            <Image
              src="/bg-imagem.jpg"
              alt="Os noivos na praia"
              fill
              priority
              sizes="(max-width: 640px) 100vw, 512px"
              className="object-cover"
              style={{ objectPosition: "center 92%" }}
            />
          </div>

          <div className="p-6 sm:p-9">
            <header className="text-center">
              <h1 className="font-serif text-3xl leading-tight sm:text-4xl">
                Olá, {main?.name ?? "convidado"}! 💍
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-foreground/80">
                É com muita alegria que convidamos você para celebrar conosco o
                dia em que diremos “sim”. Sua presença tornará esse momento
                ainda mais especial.
              </p>
            </header>

            {invite.message && (
              <blockquote className="mt-6 border-l-2 border-accent pl-4 text-left font-serif text-lg italic leading-relaxed text-foreground/75">
                {invite.message}
              </blockquote>
            )}

            <hr className="my-7 border-border" />

            {responded ? (
              <section className="text-center">
                <p className="font-serif text-2xl">Resposta já enviada 🎉</p>
                <p className="mt-2 text-sm text-muted">
                  {going.length > 0
                    ? "Confirmamos a presença de:"
                    : "Você informou que ninguém poderá comparecer. Sentiremos sua falta!"}
                </p>
                {going.length > 0 && (
                  <ul className="mt-5 space-y-2">
                    {going.map((guest) => (
                      <li
                        key={guest.id}
                        className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-base"
                      >
                        {guest.name}
                      </li>
                    ))}
                  </ul>
                )}
                <EventDetails />
                <p className="mt-7 text-xs text-muted">
                  Precisa mudar algo? Fale diretamente com os noivos.
                </p>
              </section>
            ) : (
              <RsvpForm
                token={invite.token}
                guests={ordered.map((guest) => ({
                  id: guest.id,
                  name: guest.name,
                  isMain: guest.isMain,
                }))}
                details={<EventDetails />}
              />
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function EventDetails() {
  return (
    <section className="mt-8 space-y-3 rounded-2xl bg-accent/8 px-5 py-5 text-center">
      <p className="text-[15px]">
        <span aria-hidden>📅</span> {WEDDING.date}, {WEDDING.time}
      </p>
      <div className="text-[15px]">
        <p>
          <span aria-hidden>📍</span> {WEDDING.venue}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {WEDDING.address}
        </p>
      </div>
      <p className="pt-1 font-serif text-lg text-accent-deep">
        Contamos com você! ✨
      </p>
    </section>
  );
}
