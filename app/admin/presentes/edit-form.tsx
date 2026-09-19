"use client";

import { useActionState } from "react";
import { updateGift, type GiftFormState } from "./actions";

export function GiftEditForm({
  gift,
}: {
  gift: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    targetCents: number;
    shareCents: number;
  };
}) {
  const [state, formAction, pending] = useActionState<GiftFormState, FormData>(
    updateGift,
    {},
  );

  return (
    <details className="mt-3 border-t border-border pt-3">
      <summary className="cursor-pointer text-xs font-medium text-muted hover:text-accent">
        Editar
      </summary>

      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="id" value={gift.id} />

        <Field label="Nome" name="name" defaultValue={gift.name} required />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Meta (R$)"
            name="target"
            defaultValue={reais(gift.targetCents)}
            required
          />
          <Field
            label="Cota (R$)"
            name="share"
            defaultValue={reais(gift.shareCents)}
            required
          />
        </div>

        <Field
          label="Descrição"
          name="description"
          defaultValue={gift.description ?? ""}
          placeholder="Opcional"
        />

        <Field
          label="Imagem"
          name="imageUrl"
          defaultValue={gift.imageUrl ?? ""}
          placeholder="/presentes-fotos/sofa.jpg"
        />

        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {state.error}
          </p>
        )}
        {state.created && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Salvo.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent-deep px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar alterações"}
        </button>
      </form>
    </details>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

/** Centavos → "2000,00", que é o formato que o campo devolve e o parser entende. */
function reais(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}
