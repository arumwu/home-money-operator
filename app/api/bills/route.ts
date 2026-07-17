import { getDb } from "@/db";
import { bills } from "@/db/schema";
import { jsonError, requireOwner } from "@/lib/route-auth";

export async function POST(request: Request) {
  try {
    const identity = await requireOwner(request);
    const body = (await request.json()) as {
      name?: string;
      provider?: string;
      category?: string;
      amount?: number | null;
      frequency?: "once" | "monthly" | "bimonthly" | "quarterly" | "yearly";
      nextDueDate?: string;
      autopay?: boolean;
      notes?: string;
    };
    if (!body.name?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(body.nextDueDate ?? "")) {
      return Response.json({ ok: false, error: "請填寫帳單名稱與有效到期日" }, { status: 400 });
    }
    const amount = body.amount === null || body.amount === undefined ? null : Number(body.amount);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      return Response.json({ ok: false, error: "金額格式不正確" }, { status: 400 });
    }

    const saved = await getDb()
      .insert(bills)
      .values({
        name: body.name.trim().slice(0, 80),
        provider: body.provider?.trim().slice(0, 80) || null,
        category: body.category?.trim().slice(0, 40) || "家庭帳單",
        amount: amount === null ? null : Math.round(amount),
        frequency: body.frequency ?? "monthly",
        nextDueDate: body.nextDueDate!,
        autopay: Boolean(body.autopay),
        notes: body.notes?.trim().slice(0, 300) || null,
        createdBy: identity.email,
      })
      .returning();
    return Response.json({ ok: true, bill: saved[0] }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
