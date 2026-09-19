import { defineRelations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uuid,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/** One invite per family — `token` is the public link, `respondedAt` locks the RSVP. */
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    message: text("message"),
    respondedAt: timestamp("responded_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("invites_createdBy_idx").on(table.createdBy)],
);

/** Main guest + companions, one row each. */
export const guests = pgTable(
  "guests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inviteId: uuid("invite_id")
      .notNull()
      .references(() => invites.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isMain: boolean("is_main").default(false).notNull(),
    attending: boolean("attending").default(false).notNull(),
  },
  (table) => [index("guests_inviteId_idx").on(table.inviteId)],
);

/**
 * Um presente da vaquinha. O valor arrecadado NÃO mora aqui: é sempre a soma das
 * `contributions` pagas, para não existir a possibilidade de um total denormalizado
 * divergir das linhas que o compõem.
 */
export const gifts = pgTable(
  "gifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    targetCents: integer("target_cents").notNull(),
    /** Valor de uma cota: o convidado escolhe 1, 2, 3… ou digita um valor livre. */
    shareCents: integer("share_cents").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("gifts_active_idx").on(table.active, table.sortOrder)],
);

export type ContributionStatus =
  | "pending"
  | "paid"
  | "expired"
  | "refunded"
  | "failed";

export type ContributionMethod = "pix" | "card";

/**
 * Uma tentativa de doação. Nasce `pending`; só o webhook do Mercado Pago promove
 * a `paid` — o retorno do navegador nunca credita nada.
 */
export const contributions = pgTable(
  "contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // `restrict`, não `cascade`: apagar um presente não pode levar junto o
    // registro de dinheiro que entrou. O admin arquiva em vez de apagar.
    giftId: uuid("gift_id")
      .notNull()
      .references(() => gifts.id, { onDelete: "restrict" }),
    donorName: text("donor_name").notNull(),
    donorEmail: text("donor_email"),
    message: text("message"),
    amountCents: integer("amount_cents").notNull(),
    method: text("method").$type<ContributionMethod>().notNull(),
    status: text("status")
      .$type<ContributionStatus>()
      .default("pending")
      .notNull(),
    /** id da order (Pix) ou da preference (cartão) no Mercado Pago. */
    providerRef: text("provider_ref"),
    providerStatus: text("provider_status"),
    pixQrCode: text("pix_qr_code"),
    pixQrCodeBase64: text("pix_qr_code_base64"),
    expiresAt: timestamp("expires_at"),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("contributions_giftId_idx").on(table.giftId),
    index("contributions_status_idx").on(table.status),
  ],
);

/**
 * Log cru de todo webhook recebido, válido ou não. São poucas linhas de schema e
 * é o que responde "paguei e não apareceu" sem depender de log de servidor.
 */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topic: text("topic").notNull(),
    resourceId: text("resource_id"),
    action: text("action"),
    signatureOk: boolean("signature_ok").notNull(),
    /** Por que foi ignorado, ou a divergência encontrada. Null = processado sem ressalva. */
    note: text("note"),
    contributionId: uuid("contribution_id").references(() => contributions.id, {
      onDelete: "set null",
    }),
    payload: jsonb("payload"),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
  },
  (table) => [
    index("payment_events_contributionId_idx").on(table.contributionId),
    index("payment_events_receivedAt_idx").on(table.receivedAt),
  ],
);

export const relations = defineRelations(
  {
    user,
    session,
    account,
    verification,
    invites,
    guests,
    gifts,
    contributions,
    paymentEvents,
  },
  (r) => ({
    user: {
      sessions: r.many.session(),
      accounts: r.many.account(),
      invites: r.many.invites(),
    },
    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
        optional: false,
      }),
    },
    account: {
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
        optional: false,
      }),
    },
    invites: {
      guests: r.many.guests(),
      createdByUser: r.one.user({
        from: r.invites.createdBy,
        to: r.user.id,
        optional: false,
      }),
    },
    guests: {
      invite: r.one.invites({
        from: r.guests.inviteId,
        to: r.invites.id,
        optional: false,
      }),
    },
    gifts: {
      contributions: r.many.contributions(),
    },
    contributions: {
      gift: r.one.gifts({
        from: r.contributions.giftId,
        to: r.gifts.id,
        optional: false,
      }),
      events: r.many.paymentEvents(),
    },
    paymentEvents: {
      contribution: r.one.contributions({
        from: r.paymentEvents.contributionId,
        to: r.contributions.id,
      }),
    },
  }),
);
