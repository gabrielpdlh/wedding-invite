import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
      <div className="rounded-2xl border border-border bg-card p-7 shadow-sm">
        <h1 className="font-serif text-3xl">Painel dos noivos</h1>
        <p className="mt-2 text-sm text-muted">
          Entre para gerenciar os convites.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
