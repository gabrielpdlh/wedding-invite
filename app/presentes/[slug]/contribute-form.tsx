"use client";

import { useActionState, useState } from "react";
import { startContribution, type ContributeState } from "./actions";
import { formatBRL, parseAmountToCents } from "@/lib/money";
import { MIN_CONTRIBUTION_CENTS } from "@/lib/contribution";

export function ContributeForm({
  slug,
  shareCents,
  remainingCents,
}: {
  slug: string;
  shareCents: number;
  remainingCents: number;
}) {
  const [state, formAction, pending] = useActionState<
    ContributeState,
    FormData
  >(startContribution, {});

  // Cotas que ainda cabem no que falta — não faz sentido sugerir 3 cotas de R$100
  // num presente a que faltam R$120.
  const options = [1, 2, 3].filter(
    (n) => n === 1 || n * shareCents <= remainingCents,
  );

  const [shares, setShares] = useState<number | null>(1);
  const [customAmount, setCustomAmount] = useState("");

  const customCents = customAmount ? parseAmountToCents(customAmount) : null;
  const totalCents = shares != null ? shares * shareCents : customCents;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="slug" value={slug} />
      {shares != null && <input type="hidden" name="shares" value={shares} />}

      <fieldset className="space-y-3">
        <legend className="text-sm text-muted">Quanto você quer dar?</legend>

        <div className="grid grid-cols-3 gap-2">
          {options.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setShares(n);
                setCustomAmount("");
              }}
              className={`rounded-xl border px-3 py-3 text-center transition-colors ${
                shares === n
                  ? "border-accent bg-accent/10"
                  : "border-border bg-card hover:border-accent/50"
              }`}
            >
              <span className="block text-base font-medium">
                {formatBRL(n * shareCents)}
              </span>
              <span className="block text-xs text-muted">
                {n} {n === 1 ? "cota" : "cotas"}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="customAmount" className="text-sm text-muted">
            ou outro valor (mínimo {formatBRL(MIN_CONTRIBUTION_CENTS)})
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 focus-within:border-accent">
            <span className="text-muted">R$</span>
            <input
              id="customAmount"
              name="customAmount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="150,00"
              value={customAmount}
              onChange={(event) => {
                setCustomAmount(event.target.value);
                setShares(event.target.value ? null : 1);
              }}
              className="w-full bg-transparent outline-none"
            />
          </div>
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="donorName" className="text-sm text-muted">
          Seu nome
        </label>
        <input
          id="donorName"
          name="donorName"
          required
          placeholder="Maria e João"
          className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="donorEmail" className="text-sm text-muted">
          Email (opcional — para você receber o comprovante)
        </label>
        <input
          id="donorEmail"
          name="donorEmail"
          type="email"
          autoComplete="email"
          placeholder="maria@email.com"
          className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="message" className="text-sm text-muted">
          Deixe um recado para os noivos (opcional)
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          placeholder="Felicidades! Que vocês sejam muito felizes nessa nova casa."
          className="w-full resize-y rounded-lg border border-border bg-card px-3.5 py-2.5 outline-none focus:border-accent"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm text-muted">Como quer pagar?</legend>
        <PaymentChoice
          value="pix"
          defaultChecked
          title="Pix"
          hint="QR Code na próxima tela, confirmação na hora"
        />
        <PaymentChoice
          value="card"
          title="Cartão de crédito"
          hint="Abre o Mercado Pago, com opção de parcelar"
        />
      </fieldset>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !totalCents}
        className="w-full rounded-xl bg-accent-deep px-6 py-4 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending
          ? "Abrindo pagamento…"
          : totalCents
            ? `Contribuir com ${formatBRL(totalCents)}`
            : "Escolha um valor"}
      </button>

      <p className="text-center text-xs leading-relaxed text-muted">
        O pagamento é processado pelo Mercado Pago. Os noivos não têm acesso aos
        dados do seu cartão.
      </p>
    </form>
  );
}

function PaymentChoice({
  value,
  title,
  hint,
  defaultChecked,
}: {
  value: string;
  title: string;
  hint: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/10">
      <input
        type="radio"
        name="method"
        value={value}
        defaultChecked={defaultChecked}
        className="size-4 shrink-0 accent-accent"
      />
      <span className="flex-1">
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}
