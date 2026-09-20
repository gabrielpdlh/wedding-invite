"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Agradecimento que abre logo após a confirmação e convida para a lista de
 * presentes.
 *
 * Usa o `<dialog>` nativo em vez de uma div com `position: fixed`: ele já traz
 * fechar no Esc, foco preso dentro do modal e o resto da página inerte para
 * leitores de tela — tudo que uma reimplementação manual costuma esquecer.
 */
export function ThankYouModal({
  going,
  token,
}: {
  going: string[];
  token: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  // Tira o `?obrigado=1` da URL ao fechar, senão um refresh (ou o link que o
  // convidado guardou) reabriria o modal para sempre.
  function close() {
    ref.current?.close();
    router.replace(`/convite/${token}`, { scroll: false });
  }

  const ninguem = going.length === 0;

  return (
    <dialog
      ref={ref}
      onClose={close}
      aria-labelledby="obrigado-titulo"
      className="max-w-sm rounded-3xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="p-7 text-center sm:p-8">
        <p className="text-4xl" aria-hidden>
          {ninguem ? "💌" : "🎉"}
        </p>

        <h2 id="obrigado-titulo" className="mt-3 font-serif text-3xl">
          {ninguem ? "Resposta recebida!" : "Obrigado por confirmar!"}
        </h2>

        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          {ninguem
            ? "Que pena que não vai dar! Sentiremos sua falta — obrigado por avisar."
            : going.length === 1
              ? "Sua presença está confirmada. Mal podemos esperar para celebrar com você!"
              : `Presença confirmada para ${going.length} pessoas. Mal podemos esperar para celebrar com vocês!`}
        </p>

        <div className="mt-6 rounded-2xl bg-accent/8 px-5 py-5">
          <p className="text-[15px] leading-relaxed">
            Estamos montando nosso primeiro lar e criamos uma lista de presentes
            em forma de vaquinha. Se quiser nos ajudar, qualquer valor faz
            diferença 💛
          </p>
          <Link
            href="/presentes"
            className="mt-4 inline-block rounded-xl bg-accent-deep px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Ver lista de presentes
          </Link>
        </div>

        <button
          type="button"
          onClick={close}
          className="mt-5 text-sm text-muted underline underline-offset-4 hover:text-accent"
        >
          Voltar ao convite
        </button>
      </div>
    </dialog>
  );
}
