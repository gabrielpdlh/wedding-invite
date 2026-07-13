"use client";

import { useState } from "react";

export function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    // Built on the client so the link always matches the host actually in use.
    await navigator.clipboard.writeText(
      `${window.location.origin}/convite/${token}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent hover:text-accent"
    >
      {copied ? "Copiado!" : "Copiar link"}
    </button>
  );
}
