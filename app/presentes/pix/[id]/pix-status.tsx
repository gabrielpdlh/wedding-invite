"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Status = "pending" | "paid" | "expired" | "refunded" | "failed";

export function PixStatus({
  contributionId,
  initialStatus,
  giftSlug,
  qrCode,
  qrCodeBase64,
  expiresAt,
}: {
  contributionId: string;
  initialStatus: Status;
  giftSlug: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  expiresAt: string | null;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(expiresAt));

  // A confirmação chega pelo webhook, do lado do servidor — esta tela só
  // pergunta "já?" de tempos em tempos até a resposta mudar.
  useEffect(() => {
    if (status !== "pending") return;

    const timer = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/presentes/${contributionId}/status`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = (await response.json()) as { status: Status };
        if (data.status !== "pending") setStatus(data.status);
      } catch {
        // Rede oscilando não é motivo para quebrar a tela; tenta de novo no
        // próximo tick.
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [contributionId, status]);

  useEffect(() => {
    if (status !== "pending" || !expiresAt) return;

    const timer = setInterval(() => {
      setSecondsLeft(secondsUntil(expiresAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, status]);

  async function copy() {
    if (!qrCode) return;
    await navigator.clipboard.writeText(qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (status === "paid") {
    return (
      <section className="space-y-4 text-center">
        <p className="font-serif text-3xl">Pagamento confirmado! 🎉</p>
        <p className="text-[15px] leading-relaxed text-muted">
          Muito obrigado pelo presente. Os noivos já foram avisados e o valor já
          aparece na lista.
        </p>
        <Link
          href={`/presentes/${giftSlug}`}
          className="inline-block rounded-xl bg-accent-deep px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Ver o presente
        </Link>
      </section>
    );
  }

  if (status !== "pending") {
    return (
      <section className="space-y-4 text-center">
        <p className="font-serif text-2xl">Este Pix não está mais válido</p>
        <p className="text-[15px] leading-relaxed text-muted">
          {status === "expired"
            ? "O código expirou antes do pagamento."
            : "O pagamento não foi concluído."}{" "}
          Nada foi cobrado — é só gerar outro.
        </p>
        <Link
          href={`/presentes/${giftSlug}`}
          className="inline-block rounded-xl bg-accent-deep px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Tentar de novo
        </Link>
      </section>
    );
  }

  const expired = secondsLeft !== null && secondsLeft <= 0;

  return (
    <section className="space-y-5">
      {qrCodeBase64 && !expired && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI
              vinda do Mercado Pago; next/image não teria o que otimizar. */}
          <img
            src={`data:image/png;base64,${qrCodeBase64}`}
            alt="QR Code do Pix"
            className="size-56 rounded-xl border border-border bg-white p-2"
          />
        </div>
      )}

      {expired ? (
        <div className="space-y-4 text-center">
          <p className="font-serif text-2xl">O código expirou</p>
          <p className="text-sm text-muted">
            Nada foi cobrado. Gere um novo para contribuir.
          </p>
          <Link
            href={`/presentes/${giftSlug}`}
            className="inline-block rounded-xl bg-accent-deep px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Gerar outro Pix
          </Link>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={copy}
            disabled={!qrCode}
            className="w-full rounded-xl bg-accent-deep px-6 py-4 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {copied ? "Código copiado!" : "Copiar código Pix"}
          </button>

          {qrCode && (
            <p className="max-h-20 overflow-y-auto break-all rounded-lg bg-background px-3 py-2 font-mono text-[11px] leading-relaxed text-muted">
              {qrCode}
            </p>
          )}

          <div className="flex items-center justify-center gap-2 text-sm text-muted">
            <span className="size-2 animate-pulse rounded-full bg-accent" />
            Aguardando o pagamento
            {secondsLeft !== null && ` · expira em ${formatClock(secondsLeft)}`}
          </div>

          <p className="text-center text-xs leading-relaxed text-muted">
            Abra o app do seu banco, escolha Pix → Pix Copia e Cola (ou leia o
            QR Code) e confirme. Esta tela atualiza sozinha.
          </p>
        </>
      )}
    </section>
  );
}

function secondsUntil(iso: string | null) {
  if (!iso) return null;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
