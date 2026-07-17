import { env } from "cloudflare:workers";

export function envString(key: string): string | null {
  const value = (env as unknown as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function requireEnv(key: string): string {
  const value = envString(key);
  if (!value) throw new Error(`尚未設定 ${key}`);
  return value;
}

export function gmailEnvironmentStatus() {
  return {
    clientConfigured: Boolean(
      envString("GOOGLE_CLIENT_ID") && envString("GOOGLE_CLIENT_SECRET"),
    ),
    encryptionConfigured: Boolean(
      envString("TOKEN_ENCRYPTION_KEY") && envString("OAUTH_STATE_SECRET"),
    ),
    pubsubConfigured: Boolean(envString("GOOGLE_PUBSUB_TOPIC")),
  };
}
