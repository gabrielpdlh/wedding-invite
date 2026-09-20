"use client";

import { useState } from "react";

/**
 * Copia a lista de confirmados em texto puro. Essa lista existe para ser
 * entregue a alguém — buffet, cerimonial, portaria — e sem isto o caminho é
 * selecionar a tela com o mouse e torcer.
 */
export function CopyGuestList({ names }: { names: string[] }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const texto = [
      `Confirmados — ${names.length} ${names.length === 1 ? "pessoa" : "pessoas"}`,
      "",
      ...names,
    ].join("\n");

    await navigator.clipboard.writeText(texto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={names.length === 0}
      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
    >
      {copied ? "Copiado!" : "Copiar lista"}
    </button>
  );
}
