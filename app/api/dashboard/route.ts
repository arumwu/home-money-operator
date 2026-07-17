import { getDb } from "@/db";
import {
  alerts,
  bills,
  gmailConnections,
  invoiceImports,
  invoices,
  transactions,
} from "@/db/schema";
import { gmailEnvironmentStatus } from "@/lib/env";
import { formatTaipeiDate, monthRange } from "@/lib/finance";
import { jsonError, requireHouseholdIdentity } from "@/lib/route-auth";
import { and, asc, count, desc, eq, gte, isNull, lt, sum } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await requireHouseholdIdentity(request);
    const db = getDb();
    const month = monthRange();
    const today = formatTaipeiDate();
    const inThirtyDays = new Date(`${today}T00:00:00+08:00`);
    inThirtyDays.setDate(inThirtyDays.getDate() + 30);
    const dueEnd = formatTaipeiDate(inThirtyDays);

    const [monthly, categories, recent, upcoming, storedAlerts, connection, imports, totals] =
      await Promise.all([
        db
          .select({ amount: sum(transactions.amount) })
          .from(transactions)
          .where(
            and(
              gte(transactions.occurredAt, month.start),
              lt(transactions.occurredAt, month.end),
            ),
          ),
        db
          .select({ category: transactions.category, amount: sum(transactions.amount) })
          .from(transactions)
          .where(
            and(
              gte(transactions.occurredAt, month.start),
              lt(transactions.occurredAt, month.end),
            ),
          )
          .groupBy(transactions.category)
          .orderBy(desc(sum(transactions.amount))),
        db.select().from(transactions).orderBy(desc(transactions.occurredAt)).limit(12),
        db
          .select()
          .from(bills)
          .where(
            and(
              gte(bills.nextDueDate, today),
              lt(bills.nextDueDate, dueEnd),
              eq(bills.status, "upcoming"),
            ),
          )
          .orderBy(asc(bills.nextDueDate))
          .limit(8),
        db
          .select()
          .from(alerts)
          .where(isNull(alerts.dismissedAt))
          .orderBy(desc(alerts.createdAt))
          .limit(8),
        db.select().from(gmailConnections).orderBy(asc(gmailConnections.id)).limit(1),
        db
          .select({ status: invoiceImports.status, total: count() })
          .from(invoiceImports)
          .groupBy(invoiceImports.status),
        db
          .select({ total: count(), automatic: sum(transactions.invoiceId) })
          .from(transactions),
      ]);

    const transactionTotal = Number(totals[0]?.total ?? 0);
    const automaticTotal = recent.length
      ? await db
          .select({ total: count() })
          .from(transactions)
          .where(eq(transactions.source, "einvoice"))
      : [{ total: 0 }];
    const importedThisMonth = await db
      .select({ total: count() })
      .from(invoices)
      .where(and(gte(invoices.issuedAt, month.start), lt(invoices.issuedAt, month.end)));

    const dueAlerts = upcoming
      .filter((bill) => {
        const days = Math.ceil(
          (new Date(`${bill.nextDueDate}T00:00:00+08:00`).getTime() -
            new Date(`${today}T00:00:00+08:00`).getTime()) /
            86_400_000,
        );
        return days <= 7;
      })
      .map((bill) => ({
        id: `bill-${bill.id}`,
        kind: "bill_due",
        severity: "warning",
        title: `${bill.name} 即將到期`,
        message: `${bill.nextDueDate} 前完成${bill.autopay ? "，已標示自動扣款" : "付款"}。`,
        createdAt: bill.nextDueDate,
      }));

    return Response.json({
      ok: true,
      identity,
      stats: {
        monthlySpend: Number(monthly[0]?.amount ?? 0),
        upcomingBills: upcoming.length,
        automationRate: transactionTotal
          ? Math.round((Number(automaticTotal[0]?.total ?? 0) / transactionTotal) * 100)
          : 0,
        importedThisMonth: Number(importedThisMonth[0]?.total ?? 0),
      },
      categories: categories.map((row) => ({
        category: row.category,
        amount: Number(row.amount ?? 0),
      })),
      recent,
      upcoming,
      alerts: [...dueAlerts, ...storedAlerts],
      gmail: connection[0]
        ? {
            connected: true,
            address: connection[0].gmailAddress,
            status: connection[0].status,
            lastSyncedAt: connection[0].lastSyncedAt,
            watchExpiration: connection[0].watchExpiration,
            lastError: connection[0].lastError,
          }
        : { connected: false },
      environment: gmailEnvironmentStatus(),
      imports: Object.fromEntries(imports.map((row) => [row.status, Number(row.total)])),
    });
  } catch (error) {
    return jsonError(error);
  }
}
