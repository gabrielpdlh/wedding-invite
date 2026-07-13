"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createInvite, type CreateInviteState } from "../actions";
import { CopyLink } from "../copy-link";

export function InviteForm() {
  const [state, formAction, pending] = useActionState<
    CreateInviteState,
    FormData
  >(createInvite, {});

  const [companions, setCompanions] = useState<string[]>([]);

  if (state.token) {
    return (
      <div className="rounded-2xl border border-border bg-card p-7 text-center">
        <p className="font-serif text-2xl">Convite criado 🎉</p>
        <p className="mt-2 text-sm text-muted">
          Envie este link para o convidado:
        </p>
        <p className="mt-5 break-all rounded-lg bg-background px-4 py-3 font-mono text-sm">
          /convite/{state.token}
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <CopyLink token={state.token} />
          <Link
            href="/admin"
            className="rounded-lg bg-accent-deep px-4 py-1.5 text-xs font-medium text-white"
          >
            Voltar ao painel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-6">
      <div className="space-y-1.5">
        <label htmlFor="mainName" className="text-sm text-muted">
          Convidado principal
        </label>
        <input
          id="mainName"
          name="mainName"
          required
          placeholder="Maria Silva"
          className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted">Acompanhantes</p>

        {companions.map((name, index) => (
          <div key={index} className="flex gap-2">
            <input
              name="companion"
              value={name}
              onChange={(event) =>
                setCompanions((prev) =>
                  prev.map((value, i) =>
                    i === index ? event.target.value : value,
                  ),
                )
              }
              placeholder="Nome do acompanhante"
              className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() =>
                setCompanions((prev) => prev.filter((_, i) => i !== index))
              }
              className="shrink-0 rounded-lg border border-border px-3 text-sm text-muted transition-colors hover:border-red-300 hover:text-red-600"
              aria-label={`Remover acompanhante ${index + 1}`}
            >
              Remover
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setCompanions((prev) => [...prev, ""])}
          className="w-full rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
        >
          + Adicionar acompanhante
        </button>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="message" className="text-sm text-muted">
          Mensagem personalizada (opcional)
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          placeholder="Ficaríamos muito felizes com a sua presença!"
          className="w-full resize-y rounded-lg border border-border bg-card px-3.5 py-2.5 outline-none focus:border-accent"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent-deep px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Criando…" : "Criar convite"}
      </button>
    </form>
  );
}
