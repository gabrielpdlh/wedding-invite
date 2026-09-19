import { createHmac, timingSafeEqual } from "node:crypto";
import type { ContributionStatus } from "@/db/schema";
import { amountToCents, centsToAmountString } from "./money";

const API = "https://api.mercadopago.com";

/**
 * Cliente do Mercado Pago em `fetch` puro. São quatro chamadas — o SDK oficial só
 * acrescentaria uma dependência que muda de versão sozinha.
 *
 * O Pix vai pela Orders API (`/v1/orders`) e o cartão pelo Checkout Pro
 * (`/checkout/preferences`), então o webhook recebe os dois tópicos: `order` e o
 * legado `payment`. Ver `app/api/mercadopago/webhook/route.ts`.
 */

function accessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "MERCADOPAGO_ACCESS_TOKEN ausente — pegue em Developers → Credenciais de produção.",
    );
  }
  return token;
}

export function appBaseUrl() {
  // `||`, não `??`: no .env essas chaves costumam existir vazias, e `??` deixaria
  // passar a string vazia — os back_urls do Checkout Pro sairiam sem host e o
  // Mercado Pago recusaria a preference inteira. Mesma armadilha do RESEND_FROM
  // em lib/email.ts.
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3000"
  );
}

async function mpFetch<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const { idempotencyKey, ...rest } = init;

  const response = await fetch(`${API}${path}`, {
    ...rest,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      ...rest.headers,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    // O corpo do erro traz `message` e `cause` — sem ele o debug vira adivinhação.
    throw new Error(
      `Mercado Pago ${rest.method ?? "GET"} ${path} respondeu ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  return (text ? JSON.parse(text) : {}) as T;
}

// --- Pix (Orders API) -------------------------------------------------------

export type PixCharge = {
  orderId: string;
  qrCode: string;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  expiresAt: Date;
};

export async function createPixCharge(params: {
  contributionId: string;
  amountCents: number;
  description: string;
  payerEmail: string;
  expiresInMinutes?: number;
}): Promise<PixCharge> {
  const minutes = params.expiresInMinutes ?? 30;
  const amount = centsToAmountString(params.amountCents);

  const order = await mpFetch<MpOrder>("/v1/orders", {
    method: "POST",
    // A chave de idempotência é o id da contribuição: se o convidado der dois
    // cliques, o Mercado Pago devolve a mesma order em vez de cobrar duas vezes.
    idempotencyKey: params.contributionId,
    body: JSON.stringify({
      type: "online",
      processing_mode: "automatic",
      total_amount: amount,
      external_reference: params.contributionId,
      description: params.description,
      transactions: {
        payments: [
          {
            amount,
            expiration_time: `PT${minutes}M`,
            payment_method: { id: "pix", type: "bank_transfer" },
          },
        ],
      },
      payer: { email: params.payerEmail },
    }),
  });

  const qr = extractPixQr(order);
  if (!qr?.qrCode) {
    throw new Error(
      `Order ${order.id} criada sem QR Code do Pix. Confira se há chave Pix cadastrada na conta.`,
    );
  }

  return {
    orderId: order.id,
    qrCode: qr.qrCode,
    qrCodeBase64: qr.qrCodeBase64,
    ticketUrl: qr.ticketUrl,
    expiresAt: new Date(Date.now() + minutes * 60_000),
  };
}

/**
 * A documentação do Mercado Pago descreve o QR em dois lugares conforme a página:
 * dentro de `payment_method` e no clássico `point_of_interaction.transaction_data`.
 * Olhamos nos dois — a API está em transição e não custa nada ser tolerante.
 */
function extractPixQr(order: MpOrder) {
  const payment = order.transactions?.payments?.[0];
  if (!payment) return null;

  const fromMethod = payment.payment_method;
  const fromPoi = payment.point_of_interaction?.transaction_data;
  const source = fromMethod?.qr_code ? fromMethod : fromPoi;
  if (!source) return null;

  return {
    qrCode: source.qr_code ?? null,
    qrCodeBase64: source.qr_code_base64 ?? null,
    ticketUrl: source.ticket_url ?? null,
  };
}

// --- Cartão (Checkout Pro) --------------------------------------------------

export async function createCardPreference(params: {
  contributionId: string;
  amountCents: number;
  title: string;
  payerEmail?: string;
}): Promise<{ preferenceId: string; initPoint: string }> {
  const base = appBaseUrl();
  const backUrl = `${base}/presentes/obrigado`;

  const preference = await mpFetch<MpPreference>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          id: params.contributionId,
          title: params.title,
          quantity: 1,
          currency_id: "BRL",
          unit_price: params.amountCents / 100,
        },
      ],
      ...(params.payerEmail ? { payer: { email: params.payerEmail } } : {}),
      external_reference: params.contributionId,
      back_urls: { success: backUrl, pending: backUrl, failure: backUrl },
      // `auto_return` exige URL pública: o Mercado Pago recusa a preference
      // inteira se apontar para localhost, então em dev ele fica de fora.
      ...(base.includes("localhost") ? {} : { auto_return: "approved" }),
      payment_methods: {
        // Pix e boleto já são tratados fora do Checkout Pro; oferecer de novo
        // aqui só criaria um segundo caminho para o mesmo pagamento.
        excluded_payment_types: [{ id: "bank_transfer" }, { id: "ticket" }],
      },
      statement_descriptor: "PRESENTE CASAMENTO",
    }),
  });

  return { preferenceId: preference.id, initPoint: preference.init_point };
}

// --- Consultas --------------------------------------------------------------

export function getOrder(id: string) {
  return mpFetch<MpOrder>(`/v1/orders/${id}`);
}

export function getPayment(id: string) {
  return mpFetch<MpPayment>(`/v1/payments/${id}`);
}

// --- Tradução de status -----------------------------------------------------

export type ResolvedPayment = {
  externalReference: string | null;
  status: ContributionStatus;
  providerStatus: string;
  paidCents: number | null;
};

/**
 * Orders API. Dinheiro no bolso é só `processed` + `accredited`; um Pix ainda não
 * pago chega como `action_required` / `waiting_transfer`.
 */
export function resolveOrder(order: MpOrder): ResolvedPayment {
  const providerStatus = `${order.status ?? "?"}/${order.status_detail ?? "?"}`;
  const paid =
    order.status === "processed" && order.status_detail === "accredited";

  let status: ContributionStatus = "pending";
  if (paid) status = "paid";
  else if (order.status === "refunded") status = "refunded";
  else if (order.status === "canceled" || order.status === "cancelled")
    status = "expired";
  else if (order.status === "expired") status = "expired";
  else if (order.status === "failed") status = "failed";

  const amount = order.total_paid_amount ?? order.total_amount;

  return {
    externalReference: order.external_reference ?? null,
    status,
    providerStatus,
    paidCents: paid && amount ? amountToCents(amount) : null,
  };
}

/** Tópico legado `payment`, que é por onde o Checkout Pro ainda notifica. */
export function resolvePayment(payment: MpPayment): ResolvedPayment {
  const providerStatus = `${payment.status ?? "?"}/${payment.status_detail ?? "?"}`;
  const paid = payment.status === "approved";

  let status: ContributionStatus = "pending";
  if (paid) status = "paid";
  else if (payment.status === "refunded" || payment.status === "charged_back")
    status = "refunded";
  else if (payment.status === "rejected") status = "failed";
  else if (payment.status === "cancelled") status = "expired";

  return {
    externalReference: payment.external_reference ?? null,
    status,
    providerStatus,
    paidCents:
      paid && payment.transaction_amount != null
        ? amountToCents(payment.transaction_amount)
        : null,
  };
}

// --- Assinatura do webhook --------------------------------------------------

/**
 * Valida o header `x-signature: ts=<epoch>,v1=<hex>`.
 *
 * O manifesto documentado é `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`,
 * mas a documentação é ambígua em dois pontos que só aparecem em produção: de
 * onde vem o `data.id` (query string ou corpo) e se o id alfanumérico das orders
 * (`ORD01…`) entra em minúsculas ou no original. A regra do minúsculo foi
 * escrita na época em que só existiam ids numéricos de pagamento.
 *
 * Em vez de apostar numa leitura, testamos as combinações plausíveis e aceitamos
 * a que bater, registrando qual foi. Isso NÃO enfraquece a verificação: toda
 * variante é um HMAC com o mesmo segredo, e quem não o tem não forja nenhuma.
 */
export function verifyWebhookSignature(params: {
  dataIdFromQuery: string | null;
  dataIdFromBody: string | null;
  xSignature: string | null;
  xRequestId: string | null;
  toleranceSeconds?: number;
}): { ok: boolean; variant?: string; reason?: string; tried?: number } {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret)
    return { ok: false, reason: "MERCADOPAGO_WEBHOOK_SECRET ausente" };
  if (!params.xSignature)
    return { ok: false, reason: "sem header x-signature" };

  const parts = new Map(
    params.xSignature.split(",").map((piece) => {
      const [key, ...value] = piece.split("=");
      return [key.trim(), value.join("=").trim()] as const;
    }),
  );

  const ts = parts.get("ts");
  const v1 = parts.get("v1");
  if (!ts || !v1) return { ok: false, reason: "x-signature sem ts ou v1" };

  const age = Math.abs(Date.now() / 1000 - Number(ts));
  const tolerance = params.toleranceSeconds ?? 300;
  if (!Number.isFinite(age) || age > tolerance) {
    return { ok: false, reason: `ts fora da tolerância (${Math.round(age)}s)` };
  }

  const ids: Array<[string, string | null]> = [];
  const push = (rotulo: string, valor: string | null) => {
    if (valor && !ids.some(([, v]) => v === valor)) ids.push([rotulo, valor]);
  };
  push("query", params.dataIdFromQuery);
  push("query-min", params.dataIdFromQuery?.toLowerCase() ?? null);
  push("body", params.dataIdFromBody);
  push("body-min", params.dataIdFromBody?.toLowerCase() ?? null);
  ids.push(["sem-id", null]);

  let tried = 0;
  for (const [rotuloId, id] of ids) {
    for (const comRequestId of [true, false]) {
      if (comRequestId && !params.xRequestId) continue;

      const manifest =
        (id ? `id:${id};` : "") +
        (comRequestId ? `request-id:${params.xRequestId};` : "") +
        `ts:${ts};`;

      tried += 1;
      if (matches(secret, manifest, v1)) {
        return {
          ok: true,
          variant: `${rotuloId}${comRequestId ? "+req" : "-req"}`,
          tried,
        };
      }
    }
  }

  return {
    ok: false,
    reason: `nenhuma das ${tried} variantes conferiu — provavelmente o segredo é de outro ambiente`,
    tried,
  };
}

function matches(secret: string, manifest: string, v1: string) {
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// --- Formatos de resposta (só o que a gente lê) ------------------------------

type MpQrFields = {
  qr_code?: string | null;
  qr_code_base64?: string | null;
  ticket_url?: string | null;
};

export type MpOrder = {
  id: string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  total_amount?: string;
  total_paid_amount?: string;
  transactions?: {
    payments?: Array<{
      id?: string;
      status?: string;
      status_detail?: string;
      amount?: string;
      payment_method?: MpQrFields & { id?: string; type?: string };
      point_of_interaction?: { transaction_data?: MpQrFields };
    }>;
  };
};

export type MpPayment = {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
};

export type MpPreference = { id: string; init_point: string };
