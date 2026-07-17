import { getDb } from "@/db";
import { gmailConnections } from "@/db/schema";
import { envString } from "@/lib/env";
import { syncGmailConnection } from "@/lib/gmail";

export async function POST(request: Request) {
  const expected = envString("CRON_SECRET");
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || supplied !== expected) return new Response("Unauthorized", { status: 401 });
  const connections = await getDb().select({ userEmail: gmailConnections.userEmail }).from(gmailConnections);
  const results = [];
  for (const connection of connections) {
    try {
      results.push({ userEmail: connection.userEmail, ok: true, ...(await syncGmailConnection(connection.userEmail)) });
    } catch (error) {
      results.push({ userEmail: connection.userEmail, ok: false, error: error instanceof Error ? error.message : "同步失敗" });
    }
  }
  return Response.json({ ok: results.every((result) => result.ok), results });
}
