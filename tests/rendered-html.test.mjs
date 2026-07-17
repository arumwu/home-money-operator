import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the household operator dashboard", async () => {
  const root = new URL("../", import.meta.url);
  const [page, dashboard] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/Dashboard.tsx", root), "utf8"),
    access(new URL("dist/server/index.js", root)),
  ]);
  assert.match(page, /title: "家計值班｜家庭金錢提醒與自動記帳"/);
  assert.match(page, /該繳的先提醒，花掉的自動記/);
  assert.match(dashboard, /從財政部寄信，到家庭帳本/);
  assert.match(dashboard, /Gmail OAuth/);
  assert.doesNotMatch(`${page}\n${dashboard}`, /Your site is taking shape|Building your site|codex-preview/i);
});

test("ships the implemented automation routes and migration", async () => {
  const root = new URL("../", import.meta.url);
  await Promise.all([
    access(new URL("app/api/gmail/connect/route.ts", root)),
    access(new URL("app/api/gmail/sync/route.ts", root)),
    access(new URL("app/api/cron/gmail-sync/route.ts", root)),
    access(new URL("app/api/inbound-email/route.ts", root)),
  ]);
  const migration = await readFile(new URL("drizzle/0000_white_old_lace.sql", root), "utf8");
  assert.match(migration, /CREATE TABLE `gmail_connections`/);
  assert.match(migration, /CREATE UNIQUE INDEX `invoice_dedupe_key_unique`/);
  assert.match(migration, /CREATE TABLE `alerts`/);
});
