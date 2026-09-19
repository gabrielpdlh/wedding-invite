import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { gifts } from "@/db/schema";
import { formatBRL } from "@/lib/money";

/**
 * Cadastra (ou atualiza) a lista de presentes. Idempotente: a chave é o `slug`,
 * então rodar de novo ajusta os valores sem duplicar nada e sem encostar nas
 * contribuições já recebidas.
 *
 *   npm run gifts:seed
 *
 * `imageUrl` aponta para arquivos em `public/` — enquanto o arquivo não existir,
 * deixe `null`, senão a lista mostra ícone de imagem quebrada.
 *
 * Use `public/presentes-fotos/`, NÃO `public/presentes/`: esta última colidiria
 * com a rota `/presentes/[slug]`, que trataria "sofa.jpg" como slug de presente.
 */
const LISTA = [
  // Ordem pensada para a página: quem tem foto aparece primeiro, para a lista
  // abrir bonita. Os sem foto ficam no fim até alguém fotografar.
  {
    slug: "armario-de-cozinha",
    name: "Armário de cozinha",
    targetCents: 600_000,
    shareCents: 10_000,
    imageUrl: "/cozinha.jpeg",
  },
  {
    slug: "guarda-roupas",
    name: "Guarda-roupas",
    targetCents: 400_000,
    shareCents: 10_000,
    imageUrl: "/guarda-roupas-quarto.jpeg",
  },
  {
    slug: "sofa-2-lugares",
    name: "Sofá 2 lugares",
    targetCents: 270_000,
    shareCents: 10_000,
    imageUrl: "/sofa-dois-lugares.jpeg",
  },
  {
    slug: "painel-de-tv",
    name: "Painel de TV",
    targetCents: 80_000,
    shareCents: 10_000,
    imageUrl: "/painel-tv.jpeg",
  },
  // Cota menor: R$ 100 num presente de R$ 500 deixaria só 5 cotas.
  {
    slug: "armario-do-banheiro",
    name: "Armário do banheiro",
    targetCents: 50_000,
    shareCents: 5_000,
    imageUrl: "/armario-do-banheiro.jpeg",
  },
  {
    slug: "tv-55",
    name: "TV 55”",
    targetCents: 230_000,
    shareCents: 10_000,
    imageUrl: null,
  },
  {
    slug: "mesa-de-jantar-4-lugares",
    name: "Mesa de jantar 4 lugares",
    targetCents: 140_000,
    shareCents: 10_000,
    imageUrl: null,
  },
  {
    slug: "ar-condicionado",
    name: "Ar-condicionado",
    targetCents: 180_000,
    shareCents: 10_000,
    imageUrl: null,
  },
];

async function main() {
  for (const [index, item] of LISTA.entries()) {
    const existente = await db.query.gifts.findFirst({
      where: { slug: item.slug },
    });

    if (existente) {
      await db
        .update(gifts)
        .set({
          name: item.name,
          targetCents: item.targetCents,
          shareCents: item.shareCents,
          imageUrl: item.imageUrl,
          sortOrder: index + 1,
        })
        .where(eq(gifts.id, existente.id));
      console.log(
        `atualizado  ${item.name} — ${formatBRL(item.targetCents)} (cota ${formatBRL(item.shareCents)})`,
      );
    } else {
      await db.insert(gifts).values({ ...item, sortOrder: index + 1 });
      console.log(
        `criado      ${item.name} — ${formatBRL(item.targetCents)} (cota ${formatBRL(item.shareCents)})`,
      );
    }
  }

  const total = LISTA.reduce((soma, item) => soma + item.targetCents, 0);
  console.log(`\n${LISTA.length} presentes · meta total ${formatBRL(total)}`);
  process.exit(0);
}

main();
