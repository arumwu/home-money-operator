import { getDb } from "@/db";
import {
  alerts,
  invoiceImports,
  invoiceItems,
  invoices,
  transactions,
} from "@/db/schema";
import { and, avg, count, eq, lt } from "drizzle-orm";
import { sha256Hex } from "./crypto";
import {
  extractInvoiceDocuments,
  parseEinvoiceText,
  type ParsedInvoice,
} from "./einvoice-parser";
import { categorize } from "./finance";

type ImportSource = "gmail" | "pubsub" | "webhook" | "manual";

export type AttachmentImport = {
  source: ImportSource;
  sourceMessageId: string;
  filename: string;
  bytes: Uint8Array;
};

async function createAnomalyAlert(invoice: ParsedInvoice, transactionId: number) {
  const db = getDb();
  const history = await db
    .select({ average: avg(transactions.amount), total: count() })
    .from(transactions)
    .where(
      and(
        eq(transactions.merchant, invoice.merchantName),
        lt(transactions.occurredAt, invoice.issuedAt),
      ),
    );
  const historicalAverage = Number(history[0]?.average ?? 0);
  const sampleSize = Number(history[0]?.total ?? 0);
  if (
    sampleSize < 3 ||
    invoice.totalAmount <= Math.max(historicalAverage * 2, historicalAverage + 1000)
  ) {
    return;
  }

  await db
    .insert(alerts)
    .values({
      kind: "spending_anomaly",
      severity: "warning",
      title: `${invoice.merchantName} 消費明顯偏高`,
      message: `本次 NT$ ${invoice.totalAmount.toLocaleString("zh-TW")}，高於過去平均 NT$ ${Math.round(
        historicalAverage,
      ).toLocaleString("zh-TW")}。`,
      relatedId: String(transactionId),
      fingerprint: `anomaly:${invoice.invoiceNumber}:${invoice.issuedAt.slice(0, 10)}`,
    })
    .onConflictDoNothing();
}

async function saveInvoice(importId: number, parsed: ParsedInvoice) {
  const db = getDb();
  const classification = categorize(
    parsed.merchantName,
    parsed.items.map((item) => item.name),
  );
  const dedupeKey = `${parsed.invoiceNumber}|${parsed.issuedAt.slice(0, 10)}|${parsed.totalAmount}`;
  const inserted = await db
    .insert(invoices)
    .values({
      importId,
      invoiceNumber: parsed.invoiceNumber,
      issuedAt: parsed.issuedAt,
      merchantName: parsed.merchantName,
      sellerTaxId: parsed.sellerTaxId,
      totalAmount: parsed.totalAmount,
      category: classification.category,
      dedupeKey,
    })
    .onConflictDoNothing()
    .returning({ id: invoices.id });

  const invoiceId = inserted[0]?.id;
  if (!invoiceId) return { duplicate: true };

  if (parsed.items.length) {
    await db.insert(invoiceItems).values(
      parsed.items.map((item) => ({
        invoiceId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        category: categorize(parsed.merchantName, [item.name]).category,
      })),
    );
  }

  const transaction = await db
    .insert(transactions)
    .values({
      invoiceId,
      occurredAt: parsed.issuedAt,
      merchant: parsed.merchantName,
      description: parsed.items.slice(0, 3).map((item) => item.name).join("、") || null,
      amount: parsed.totalAmount,
      category: classification.category,
      source: "einvoice",
      confidence: classification.confidence,
    })
    .returning({ id: transactions.id });

  if (transaction[0]?.id) {
    await createAnomalyAlert(parsed, transaction[0].id);
  }
  return { duplicate: false };
}

export async function processInvoiceAttachment(input: AttachmentImport) {
  const db = getDb();
  const attachmentHash = await sha256Hex(input.bytes);
  const existingHash = await db
    .select({ id: invoiceImports.id })
    .from(invoiceImports)
    .where(eq(invoiceImports.attachmentHash, attachmentHash))
    .limit(1);
  if (existingHash[0]) {
    return { status: "duplicate" as const, invoices: 0, duplicates: 1 };
  }

  const created = await db
    .insert(invoiceImports)
    .values({
      source: input.source,
      sourceMessageId: input.sourceMessageId,
      sourceFilename: input.filename,
      attachmentHash,
      status: "received",
    })
    .onConflictDoNothing()
    .returning({ id: invoiceImports.id });
  const importId = created[0]?.id;
  if (!importId) {
    return { status: "duplicate" as const, invoices: 0, duplicates: 1 };
  }

  try {
    const documents = extractInvoiceDocuments(input.filename, input.bytes);
    const parsed = documents.flatMap((document) => parseEinvoiceText(document.text));
    if (!parsed.length) {
      throw new Error("附件中找不到可辨識的發票號碼、日期與金額欄位");
    }

    let duplicates = 0;
    let saved = 0;
    for (const invoice of parsed) {
      const result = await saveInvoice(importId, invoice);
      if (result.duplicate) duplicates += 1;
      else saved += 1;
    }

    await db
      .update(invoiceImports)
      .set({
        status: saved ? "parsed" : "duplicate",
        invoiceCount: saved,
        duplicateCount: duplicates,
        processedAt: new Date().toISOString(),
      })
      .where(eq(invoiceImports.id, importId));
    return {
      status: saved ? ("parsed" as const) : ("duplicate" as const),
      invoices: saved,
      duplicates,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "附件解析失敗";
    await db
      .update(invoiceImports)
      .set({
        status: "error",
        errorMessage: message.slice(0, 500),
        processedAt: new Date().toISOString(),
      })
      .where(eq(invoiceImports.id, importId));
    throw error;
  }
}
