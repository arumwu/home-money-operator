import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const householdMembers = sqliteTable(
  "household_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    displayName: text("display_name"),
    role: text("role", { enum: ["owner", "viewer"] })
      .notNull()
      .default("viewer"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("member_email_unique").on(table.email)],
);

export const bills = sqliteTable(
  "bills",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    provider: text("provider"),
    category: text("category").notNull().default("家庭帳單"),
    amount: integer("amount"),
    frequency: text("frequency", {
      enum: ["once", "monthly", "bimonthly", "quarterly", "yearly"],
    })
      .notNull()
      .default("monthly"),
    nextDueDate: text("next_due_date").notNull(),
    autopay: integer("autopay", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["upcoming", "paid", "overdue", "paused"] })
      .notNull()
      .default("upcoming"),
    notes: text("notes"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("bill_due_date_idx").on(table.nextDueDate),
    index("bill_status_idx").on(table.status),
  ],
);

export const gmailConnections = sqliteTable(
  "gmail_connections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    gmailAddress: text("gmail_address").notNull(),
    refreshTokenCiphertext: text("refresh_token_ciphertext").notNull(),
    scopes: text("scopes").notNull(),
    status: text("status", { enum: ["connected", "error", "revoked"] })
      .notNull()
      .default("connected"),
    lastHistoryId: text("last_history_id"),
    watchExpiration: text("watch_expiration"),
    lastSyncedAt: text("last_synced_at"),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("gmail_user_unique").on(table.userEmail)],
);

export const invoiceImports = sqliteTable(
  "invoice_imports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source", { enum: ["gmail", "pubsub", "webhook", "manual"] })
      .notNull(),
    sourceMessageId: text("source_message_id"),
    sourceFilename: text("source_filename"),
    attachmentHash: text("attachment_hash"),
    status: text("status", { enum: ["received", "parsed", "duplicate", "error"] })
      .notNull()
      .default("received"),
    invoiceCount: integer("invoice_count").notNull().default(0),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    errorMessage: text("error_message"),
    receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    processedAt: text("processed_at"),
  },
  (table) => [
    uniqueIndex("import_message_unique").on(table.source, table.sourceMessageId),
    uniqueIndex("import_attachment_hash_unique").on(table.attachmentHash),
    index("import_received_at_idx").on(table.receivedAt),
  ],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    importId: integer("import_id").references(() => invoiceImports.id, {
      onDelete: "set null",
    }),
    invoiceNumber: text("invoice_number").notNull(),
    issuedAt: text("issued_at").notNull(),
    merchantName: text("merchant_name").notNull(),
    sellerTaxId: text("seller_tax_id"),
    totalAmount: integer("total_amount").notNull(),
    category: text("category").notNull(),
    source: text("source").notNull().default("einvoice"),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("invoice_dedupe_key_unique").on(table.dedupeKey),
    index("invoice_issued_at_idx").on(table.issuedAt),
    index("invoice_category_idx").on(table.category),
  ],
);

export const invoiceItems = sqliteTable(
  "invoice_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: real("quantity"),
    unitPrice: integer("unit_price"),
    amount: integer("amount"),
    category: text("category"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("invoice_item_invoice_idx").on(table.invoiceId)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    invoiceId: integer("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    occurredAt: text("occurred_at").notNull(),
    merchant: text("merchant").notNull(),
    description: text("description"),
    amount: integer("amount").notNull(),
    category: text("category").notNull(),
    source: text("source", { enum: ["einvoice", "manual", "bill"] })
      .notNull(),
    confidence: real("confidence").notNull().default(0.5),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("transaction_invoice_unique").on(table.invoiceId),
    index("transaction_occurred_at_idx").on(table.occurredAt),
    index("transaction_category_idx").on(table.category),
  ],
);

export const alerts = sqliteTable(
  "alerts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: ["bill_due", "spending_anomaly", "sync_error"] })
      .notNull(),
    severity: text("severity", { enum: ["info", "warning", "critical"] })
      .notNull()
      .default("info"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    relatedId: text("related_id"),
    fingerprint: text("fingerprint").notNull(),
    dismissedAt: text("dismissed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("alert_fingerprint_unique").on(table.fingerprint),
    index("alert_created_at_idx").on(table.createdAt),
  ],
);
