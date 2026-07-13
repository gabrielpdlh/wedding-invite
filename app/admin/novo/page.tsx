import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { InviteForm } from "./invite-form";

export default async function NewInvitePage() {
  await requireAdmin();

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">
        ← Voltar
      </Link>
      <h1 className="mt-4 font-serif text-3xl">Novo convite</h1>
      <InviteForm />
    </main>
  );
}
