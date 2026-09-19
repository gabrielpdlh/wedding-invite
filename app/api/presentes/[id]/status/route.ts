import { db } from "@/db";

/**
 * Consultado pela tela do Pix a cada poucos segundos, só para trocar a UI quando
 * o webhook confirmar. Não decide nada: apenas lê o status que o webhook gravou.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/presentes/[id]/status">,
) {
  const { id } = await context.params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }

  const contribution = await db.query.contributions.findFirst({
    where: { id },
    with: { gift: true },
  });

  if (!contribution) {
    return Response.json({ error: "não encontrado" }, { status: 404 });
  }

  // Só o que a tela precisa — nada de devolver a linha crua com email do doador.
  return Response.json({
    status: contribution.status,
    giftSlug: contribution.gift.slug,
    expiresAt: contribution.expiresAt,
  });
}
