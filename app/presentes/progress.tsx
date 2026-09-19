import { formatBRL } from "@/lib/money";
import { isFunded, progressPercent, remainingCents } from "@/lib/gifts";

type Gift = { targetCents: number; raisedCents: number };

export function ProgressBar({ gift }: { gift: Gift }) {
  const percent = progressPercent(gift);
  const funded = isFunded(gift);

  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-accent/15"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${percent}% arrecadado`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${
          funded ? "bg-emerald-500" : "bg-accent"
        }`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function ProgressLabel({ gift }: { gift: Gift }) {
  if (isFunded(gift)) {
    return (
      <p className="text-sm font-medium text-emerald-700">
        Presenteado! {formatBRL(gift.raisedCents)} arrecadados 🎉
      </p>
    );
  }

  return (
    <p className="text-sm text-muted">
      <span className="font-medium text-foreground">
        {formatBRL(gift.raisedCents)}
      </span>{" "}
      de {formatBRL(gift.targetCents)} · faltam{" "}
      {formatBRL(remainingCents(gift))}
    </p>
  );
}
