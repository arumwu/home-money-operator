import { getDb } from "@/db";
import { gmailConnections } from "@/db/schema";
import { sealSecret, verifyOAuthState } from "@/lib/crypto";
import { requireEnv } from "@/lib/env";
import { gmailProfile } from "@/lib/gmail";
import { requireOwner } from "@/lib/route-auth";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const identity = await requireOwner(request);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state || !(await verifyOAuthState(state, identity.email))) {
      throw new Error("Google 授權回傳資料無效或已逾時");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: requireEnv("GOOGLE_CLIENT_ID"),
        client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
        redirect_uri: `${url.origin}/api/gmail/callback`,
        grant_type: "authorization_code",
      }),
    });
    const token = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
      error_description?: string;
    };
    if (!tokenResponse.ok || !token.access_token) {
      throw new Error(token.error_description ?? "Google OAuth 授權交換失敗");
    }

    const profile = await gmailProfile(token.access_token);
    const db = getDb();
    const existing = await db
      .select()
      .from(gmailConnections)
      .where(eq(gmailConnections.userEmail, identity.email))
      .limit(1);
    const encrypted = token.refresh_token
      ? await sealSecret(token.refresh_token)
      : existing[0]?.refreshTokenCiphertext;
    if (!encrypted) throw new Error("Google 未回傳離線 refresh token，請重新授權");

    await db
      .insert(gmailConnections)
      .values({
        userEmail: identity.email,
        gmailAddress: profile.emailAddress,
        refreshTokenCiphertext: encrypted,
        scopes: token.scope ?? "https://www.googleapis.com/auth/gmail.readonly",
        status: "connected",
        lastHistoryId: profile.historyId,
        lastError: null,
      })
      .onConflictDoUpdate({
        target: gmailConnections.userEmail,
        set: {
          gmailAddress: profile.emailAddress,
          refreshTokenCiphertext: encrypted,
          scopes: token.scope ?? "https://www.googleapis.com/auth/gmail.readonly",
          status: "connected",
          lastHistoryId: profile.historyId,
          lastError: null,
          updatedAt: new Date().toISOString(),
        },
      });
    return Response.redirect(`${url.origin}/?gmail=connected`, 302);
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : "Gmail 授權失敗");
    return Response.redirect(`${url.origin}/?gmail=error&message=${message}`, 302);
  }
}
