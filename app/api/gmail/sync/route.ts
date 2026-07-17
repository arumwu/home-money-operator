import { syncGmailConnection } from "@/lib/gmail";
import { jsonError, requireOwner } from "@/lib/route-auth";

export async function POST(request: Request) {
  try {
    const identity = await requireOwner(request);
    const result = await syncGmailConnection(identity.email);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
