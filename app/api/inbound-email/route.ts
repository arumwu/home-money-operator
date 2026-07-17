import { envString } from "@/lib/env";
import { processInvoiceAttachment } from "@/lib/invoice-import";

function decodeBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function POST(request: Request) {
  const expected = envString("INBOUND_EMAIL_SECRET");
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || supplied !== expected) return new Response("Unauthorized", { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";
  const inputs: Array<{ messageId: string; filename: string; bytes: Uint8Array }> = [];
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      messageId?: string;
      attachments?: Array<{ filename?: string; contentBase64?: string }>;
    };
    for (const attachment of body.attachments ?? []) {
      if (!attachment.contentBase64) continue;
      inputs.push({
        messageId: body.messageId ?? crypto.randomUUID(),
        filename: attachment.filename ?? "einvoice.csv",
        bytes: decodeBase64(attachment.contentBase64),
      });
    }
  } else {
    const form = await request.formData();
    const messageId = String(form.get("messageId") ?? crypto.randomUUID());
    for (const value of form.getAll("attachment")) {
      if (value instanceof File) {
        inputs.push({
          messageId,
          filename: value.name || "einvoice.csv",
          bytes: new Uint8Array(await value.arrayBuffer()),
        });
      }
    }
  }

  if (!inputs.length) {
    return Response.json({ ok: false, error: "沒有 CSV、TXT 或 ZIP 附件" }, { status: 400 });
  }
  const results = [];
  for (const [index, input] of inputs.entries()) {
    try {
      results.push(
        await processInvoiceAttachment({
          source: "webhook",
          sourceMessageId: `${input.messageId}:${index}`,
          filename: input.filename,
          bytes: input.bytes,
        }),
      );
    } catch (error) {
      results.push({ status: "error", error: error instanceof Error ? error.message : "解析失敗" });
    }
  }
  return Response.json({ ok: true, results });
}
