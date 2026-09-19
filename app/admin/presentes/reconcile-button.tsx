"use client";

import { useActionState } from "react";
import { reconcileNow, type ReconcileState } from "./actions";

export function ReconcileButton() {
  const [state, formAction, pending] = useActionState<ReconcileState, FormData>(
    reconcileNow,
    {},
  );

  return (
    <form action={formAction} className="space-y-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
      >
        {pending ? "Consultando…" : "Conferir pagamentos"}
      </button>

      {state.summary && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {state.summary}
        </p>
      )}
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
