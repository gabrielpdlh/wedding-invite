"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push("/admin/login");
        router.refresh();
      }}
      className="rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
    >
      Sair
    </button>
  );
}
