import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-12 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">
        Nosso casamento
      </p>
      <h1 className="mt-4 font-serif text-4xl">Em breve</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Se você recebeu um convite, use o link pessoal que enviamos para
        confirmar sua presença.
      </p>
      <Link
        href="/admin"
        className="mt-8 text-xs text-muted underline underline-offset-4 hover:text-accent"
      >
        Área dos noivos
      </Link>
    </main>
  );
}
