"use client";

import { useActionState } from "react";
import { createGift, type GiftFormState } from "./actions";

export function GiftForm() {
  const [state, formAction, pending] = useActionState<GiftFormState, FormData>(
    createGift,
    {},
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-border bg-card p-5"
    >
      <h2 className="font-serif text-xl">Novo presente</h2>

      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm text-muted">
          Nome
        </label>
        <input
          id="name"
          name="name"
          required
          placeholder="Sofá da sala"
          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 outline-none focus:border-accent"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="target" className="text-sm text-muted">
            Meta (R$)
          </label>
          <input
            id="target"
            name="target"
            required
            inputMode="decimal"
            placeholder="900"
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 outline-none focus:border-accent"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="share" className="text-sm text-muted">
            Valor da cota (R$)
          </label>
          <input
            id="share"
            name="share"
            required
            inputMode="decimal"
            placeholder="100"
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm text-muted">
          Descrição (opcional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          placeholder="Para as tardes de domingo assistindo série."
          className="w-full resize-y rounded-lg border border-border bg-background px-3.5 py-2.5 outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="imageUrl" className="text-sm text-muted">
          URL da imagem (opcional)
        </label>
        <input
          id="imageUrl"
          name="imageUrl"
          type="url"
          placeholder="https://…"
          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 outline-none focus:border-accent"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {state.created && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          “{state.created}” adicionado à lista.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent-deep px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Adicionar presente"}
      </button>
    </form>
  );
}
