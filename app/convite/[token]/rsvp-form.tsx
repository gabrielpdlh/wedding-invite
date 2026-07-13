"use client";

import { useActionState, useState, type ReactNode } from "react";
import { confirmRsvp, type RsvpState } from "./actions";

type Guest = { id: string; name: string; isMain: boolean };

export function RsvpForm({
  token,
  guests,
  details,
}: {
  token: string;
  guests: Guest[];
  details: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<RsvpState, FormData>(
    confirmRsvp,
    {},
  );

  // Everyone is presumed present until the guest says otherwise.
  const [attending, setAttending] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(guests.map((guest) => [guest.id, true])),
  );

  const goingCount = Object.values(attending).filter(Boolean).length;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <p className="text-center text-[15px] font-medium">
        Confirme a presença de:
      </p>

      <ul className="space-y-3">
        {guests.map((guest) => (
          <li key={guest.id}>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors ${
                attending[guest.id]
                  ? "border-accent bg-accent/10"
                  : "border-border bg-card"
              }`}
            >
              <input
                type="checkbox"
                name="attending"
                value={guest.id}
                checked={attending[guest.id] ?? false}
                onChange={(event) =>
                  setAttending((prev) => ({
                    ...prev,
                    [guest.id]: event.target.checked,
                  }))
                }
                className="size-5 shrink-0 accent-accent"
              />
              <span className="flex-1 text-base">{guest.name}</span>
              {guest.isMain && (
                <span className="text-xs uppercase tracking-wide text-muted">
                  você
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>

      <p className="text-center text-sm text-muted">
        {goingCount === 0
          ? "Ninguém marcado como presente."
          : `${goingCount} ${goingCount === 1 ? "pessoa vai" : "pessoas vão"} comparecer.`}
      </p>

      {details}

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-accent-deep px-6 py-4 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Marcar presença"}
      </button>

      <p className="text-center text-xs text-muted">
        Atenção: a resposta não poderá ser alterada depois de enviada.
      </p>
    </form>
  );
}
