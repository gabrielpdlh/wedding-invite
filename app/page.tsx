import { redirect } from "next/navigation";

/**
 * A lista de presentes virou a porta de entrada do site. O convite continua
 * vivendo em `/convite/[token]`, com link próprio, e o painel em `/admin` —
 * nenhum dos dois passa por aqui.
 */
export default function Home() {
  redirect("/presentes");
}
