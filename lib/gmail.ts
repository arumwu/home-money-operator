import { getDb } from "@/db";
import { gmailConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { base64UrlToBytes, openSecret } from "./crypto";
import { envString, requireEnv } from "./env";
import { processInvoiceAttachment } from "./invoice-import";

type GmailPart = {
  filename?: string;
  mimeType?: string;
  body?: { attachmentId?: string; data?: string };
  parts?: GmailPart[];
};

type GmailMessage = {
  id: string;
  historyId?: string;
  payload?: GmailPart;
};

type GmailListResponse = {
  messages?: Array<{ id: string }>;
  nextPageToken?: string;
};

export async function refreshGmailAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const result = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !result.access_token) {
    throw new Error(`Gmail 憑證更新失敗：${result.error ?? response.status}`);
  }
  return result.access_token;
}

async function gmailJson<T>(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const result = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(result.error?.message ?? `Gmail API ${response.status}`);
  }
  return result;
}

export async function gmailProfile(accessToken: string) {
  return gmailJson<{ emailAddress: string; historyId: string }>(
    accessToken,
    "/users/me/profile",
  );
}

function attachmentParts(part?: GmailPart): GmailPart[] {
  if (!part) return [];
  const nested = part.parts?.flatMap(attachmentParts) ?? [];
  const filename = part.filename?.trim() ?? "";
  return /\.(csv|txt|zip)$/i.test(filename) ? [part, ...nested] : nested;
}

async function attachmentBytes(
  accessToken: string,
  messageId: string,
  part: GmailPart,
) {
  if (part.body?.data) return base64UrlToBytes(part.body.data);
  const attachmentId = part.body?.attachmentId;
  if (!attachmentId) throw new Error("Gmail 附件缺少 attachmentId");
  const attachment = await gmailJson<{ data: string }>(
    accessToken,
    `/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(
      attachmentId,
    )}`,
  );
  return base64UrlToBytes(attachment.data);
}

async function renewWatch(accessToken: string) {
  const topicName = envString("GOOGLE_PUBSUB_TOPIC");
  if (!topicName) return null;
  return gmailJson<{ historyId: string; expiration: string }>(
    accessToken,
    "/users/me/watch",
    {
      method: "POST",
      body: JSON.stringify({
        topicName,
        labelIds: ["INBOX"],
        labelFilterBehavior: "INCLUDE",
      }),
    },
  );
}

export async function syncGmailConnection(userEmail: string) {
  const db = getDb();
  const connection = await db
    .select()
    .from(gmailConnections)
    .where(eq(gmailConnections.userEmail, userEmail))
    .limit(1);
  if (!connection[0]) throw new Error("尚未連接 Gmail 專用信箱");

  try {
    const refreshToken = await openSecret(connection[0].refreshTokenCiphertext);
    const accessToken = await refreshGmailAccessToken(refreshToken);
    const query =
      envString("GMAIL_QUERY") ??
      'has:attachment newer_than:2y {subject:"消費發票彙整通知" filename:csv filename:zip filename:txt}';
    const list = await gmailJson<GmailListResponse>(
      accessToken,
      `/users/me/messages?maxResults=60&q=${encodeURIComponent(query)}`,
    );

    let messages = 0;
    let attachments = 0;
    let invoices = 0;
    let duplicates = 0;
    const errors: string[] = [];

    for (const entry of list.messages ?? []) {
      const message = await gmailJson<GmailMessage>(
        accessToken,
        `/users/me/messages/${encodeURIComponent(entry.id)}?format=full`,
      );
      messages += 1;
      for (const part of attachmentParts(message.payload)) {
        const filename = part.filename || "einvoice.csv";
        const attachmentKey = part.body?.attachmentId || filename;
        try {
          const bytes = await attachmentBytes(accessToken, message.id, part);
          const result = await processInvoiceAttachment({
            source: "gmail",
            sourceMessageId: `${message.id}:${attachmentKey}`,
            filename,
            bytes,
          });
          attachments += 1;
          invoices += result.invoices;
          duplicates += result.duplicates;
        } catch (error) {
          errors.push(error instanceof Error ? error.message : "附件處理失敗");
        }
      }
    }

    const profile = await gmailProfile(accessToken);
    let watch: { historyId: string; expiration: string } | null = null;
    try {
      const expiresAt = Number(connection[0].watchExpiration ?? 0);
      if (!expiresAt || expiresAt - Date.now() < 24 * 60 * 60_000) {
        watch = await renewWatch(accessToken);
      }
    } catch (error) {
      errors.push(`推播監看未啟用：${error instanceof Error ? error.message : "未知錯誤"}`);
    }

    await db
      .update(gmailConnections)
      .set({
        status: "connected",
        lastHistoryId: watch?.historyId ?? profile.historyId,
        watchExpiration: watch?.expiration ?? connection[0].watchExpiration,
        lastSyncedAt: new Date().toISOString(),
        lastError: errors.length ? errors.slice(0, 3).join("；").slice(0, 500) : null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(gmailConnections.userEmail, userEmail));

    return { messages, attachments, invoices, duplicates, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail 同步失敗";
    await db
      .update(gmailConnections)
      .set({ status: "error", lastError: message.slice(0, 500), updatedAt: new Date().toISOString() })
      .where(eq(gmailConnections.userEmail, userEmail));
    throw error;
  }
}
