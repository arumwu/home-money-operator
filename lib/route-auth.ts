import { getDb } from "@/db";
import { householdMembers } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { envString } from "./env";

const EMAIL_HEADER = "oai-authenticated-user-email";
const NAME_HEADER = "oai-authenticated-user-full-name";
const NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";

export type HouseholdIdentity = {
  email: string;
  displayName: string;
  role: "owner" | "viewer";
};

function decodeName(request: Request, email: string) {
  const encoded = request.headers.get(NAME_HEADER);
  if (
    encoded &&
    request.headers.get(NAME_ENCODING_HEADER) === "percent-encoded-utf-8"
  ) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return email;
    }
  }
  return email;
}

function requestEmail(request: Request) {
  const email = request.headers.get(EMAIL_HEADER)?.trim().toLowerCase();
  if (email) return email;

  const url = new URL(request.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return "owner@local.home-money";
  }
  return null;
}

export async function requireHouseholdIdentity(
  request: Request,
): Promise<HouseholdIdentity> {
  const email = requestEmail(request);
  if (!email) throw new Response("需要登入", { status: 401 });

  const db = getDb();
  const existing = await db
    .select()
    .from(householdMembers)
    .where(eq(householdMembers.email, email))
    .limit(1);

  if (existing[0]) {
    const primaryOwner = envString("PRIMARY_OWNER_EMAIL")?.toLowerCase();
    if (primaryOwner === email && existing[0].role !== "owner") {
      await db
        .update(householdMembers)
        .set({ role: "owner", updatedAt: new Date().toISOString() })
        .where(eq(householdMembers.email, email));
      existing[0].role = "owner";
    }
    return {
      email,
      displayName: existing[0].displayName ?? email,
      role: existing[0].role,
    };
  }

  const primaryOwner = envString("PRIMARY_OWNER_EMAIL")?.toLowerCase();
  const totals = await db.select({ value: count() }).from(householdMembers);
  const role = primaryOwner
    ? primaryOwner === email
      ? "owner"
      : "viewer"
    : Number(totals[0]?.value ?? 0) === 0
      ? "owner"
      : "viewer";
  const displayName = decodeName(request, email);

  await db
    .insert(householdMembers)
    .values({ email, displayName, role })
    .onConflictDoNothing();

  const saved = await db
    .select()
    .from(householdMembers)
    .where(eq(householdMembers.email, email))
    .limit(1);

  return {
    email,
    displayName: saved[0]?.displayName ?? displayName,
    role: saved[0]?.role ?? role,
  };
}

export async function requireOwner(request: Request) {
  const identity = await requireHouseholdIdentity(request);
  if (identity.role !== "owner") {
    throw new Response("唯讀成員不能修改家庭資料", { status: 403 });
  }
  return identity;
}

export function jsonError(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "處理失敗";
  return Response.json({ ok: false, error: message }, { status: 500 });
}
