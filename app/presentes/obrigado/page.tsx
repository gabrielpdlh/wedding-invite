import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Obrigado! | Nosso Casamento",
  robots: { index: false, follow: false },
};

/**
 * Página de retorno do Checkout Pro. É decorativa de propósito: quem credita o
 * pagamento é o webhook, então aqui não se lê status nem se atualiza nada. O
 * convidado pode ter fechado a aba antes de voltar, e o valor entra do mesmo
 * jeito.
 */
export default function ThanksPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12 text-center">
      <p className="font-serif text-4xl">Obrigado! 💛</p>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        Recebemos seu presente. Pagamentos no cartão levam alguns instantes para
        serem aprovados pelo Mercado Pago — assim que isso acontecer, o valor
        aparece na lista automaticamente.
      </p>
      <Link
        href="/presentes"
        className="mx-auto mt-8 inline-block rounded-xl bg-accent-deep px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Voltar para a lista
      </Link>
    </main>
  );
}
