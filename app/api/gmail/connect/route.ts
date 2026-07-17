import { createOAuthState } from "@/lib/crypto";
import { requireEnv } from "@/lib/env";
import { jsonError, requireOwner } from "@/lib/route-auth";

export async function GET(request: Request) {
  try {
    const identity = await requireOwner(request);
    const origin = new URL(request.url).origin;
    const state = await createOAuthState(identity.email);
    const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorization.search = new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      redirect_uri: `${origin}/api/gmail/callback`,
      response_type: "code",
      scope: "openid email https://www.googleapis.com/auth/gmail.readonly",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    }).toString();
    return Response.redirect(authorization, 302);
  } catch (error) {
    return jsonError(error);
  }
}
