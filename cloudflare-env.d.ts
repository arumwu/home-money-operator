/// <reference types="@cloudflare/workers-types" />

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}

declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
    DB: D1Database;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    TOKEN_ENCRYPTION_KEY?: string;
    OAUTH_STATE_SECRET?: string;
    GMAIL_QUERY?: string;
    GOOGLE_PUBSUB_TOPIC?: string;
    CRON_SECRET?: string;
    INBOUND_EMAIL_SECRET?: string;
    PRIMARY_OWNER_EMAIL?: string;
  }
}
