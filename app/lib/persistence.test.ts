import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getOnePageMedia } from "./one-page-store.ts";
import { getPersistenceMode, getSupabaseServerConfig } from "./persistence-config.ts";
import { supabaseInsert, supabaseRpc, uploadSnapshotObject } from "./supabase-persistence.ts";

test("local persistence is the safe default and incomplete Supabase config fails closed", () => {
  const oldMode = process.env.CO_BUILDER_PERSISTENCE;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.CO_BUILDER_PERSISTENCE;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    assert.equal(getPersistenceMode(), "local");
    assert.throws(() => getSupabaseServerConfig(), /SUPABASE_PERSISTENCE_NOT_CONFIGURED/);
  } finally {
    if (oldMode === undefined) delete process.env.CO_BUILDER_PERSISTENCE; else process.env.CO_BUILDER_PERSISTENCE = oldMode;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test("Supabase adapter keeps service credentials server-side and sends immutable uploads", async () => {
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-secret";
  const requests: Array<{ url: string; method: string; authorization: string | null; upsert: string | null; body: string }> = [];
  globalThis.fetch = async (input, init) => {
    const requestHeaders = new Headers(init?.headers);
    requests.push({
      url: String(input),
      method: init?.method ?? "GET",
      authorization: requestHeaders.get("authorization"),
      upsert: requestHeaders.get("x-upsert"),
      body: typeof init?.body === "string" ? init.body : "[binary]",
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    await supabaseInsert("co_builder_proposal_snapshots", { id: "snapshot" });
    await supabaseRpc("co_builder_save_price_override", { p_room_number: "704" });
    await uploadSnapshotObject("one-pages/id/0.webp", new Uint8Array([1, 2, 3]), "image/webp");
    assert.equal(requests.length, 3);
    assert.ok(requests.every((request) => request.authorization === "Bearer server-secret"));
    assert.equal(requests[2].upsert, "false");
    assert.match(requests[2].url, /storage\/v1\/object\/co-builder-snapshots\/one-pages\/id\/0\.webp$/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test("migration enforces RLS, atomic price history and immutable snapshots", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/20261017153505_co_builder_persistence.sql", import.meta.url), "utf8");
  for (const table of ["co_builder_price_overrides", "co_builder_price_history", "co_builder_proposal_snapshots", "co_builder_one_page_snapshots"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /for update/i);
  assert.match(sql, /PRICE_CONFLICT/);
  assert.match(sql, /SNAPSHOT_IMMUTABLE/);
  assert.match(sql, /PRICE_HISTORY_IMMUTABLE/);
  assert.match(sql, /revoke all on function public\.co_builder_save_price_override[\s\S]+from public, anon, authenticated/i);
});

test("security migration provides distributed service-only rate limiting", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/20261017184000_snapshot_api_security.sql", import.meta.url), "utf8");
  assert.match(sql, /create table public\.co_builder_rate_limits/i);
  assert.match(sql, /alter table public\.co_builder_rate_limits enable row level security/i);
  assert.match(sql, /on conflict \(scope, client_key, window_started_at\)[\s\S]+request_count \+ 1/i);
  assert.match(sql, /revoke all on function public\.co_builder_consume_rate_limit[\s\S]+from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.co_builder_consume_rate_limit[\s\S]+to service_role/i);
});

test("Supabase errors retain server detail for domain conflict mapping", async () => {
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-secret";
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "PRICE_CONFLICT", details: "Expected 1, actual 2" }), { status: 400 });
  try {
    await assert.rejects(
      () => supabaseRpc("co_builder_save_price_override", {}),
      (error: unknown) => error instanceof Error && "detail" in error && String(error.detail).includes("PRICE_CONFLICT"),
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test("missing Supabase media returns null without masking upstream failures", async () => {
  const oldFetch = globalThis.fetch;
  const oldMode = process.env.CO_BUILDER_PERSISTENCE;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldBucket = process.env.SUPABASE_SNAPSHOT_BUCKET;
  process.env.CO_BUILDER_PERSISTENCE = "supabase";
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-secret";
  process.env.SUPABASE_SNAPSHOT_BUCKET = "co-builder-snapshots";
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ message: "Object not found" }), { status: 404 });
    assert.equal(await getOnePageMedia("00000000-0000-4000-8000-000000000000", "0.webp"), null);

    globalThis.fetch = async () => new Response(JSON.stringify({ statusCode: "404", error: "not_found", message: "Object not found", code: "NoSuchKey" }), { status: 400 });
    assert.equal(await getOnePageMedia("00000000-0000-4000-8000-000000000000", "0.webp"), null);

    globalThis.fetch = async () => new Response(JSON.stringify({ statusCode: "400", error: "invalid_request", message: "Invalid bucket" }), { status: 400 });
    await assert.rejects(
      () => getOnePageMedia("00000000-0000-4000-8000-000000000000", "0.webp"),
      (error: unknown) => error instanceof Error && "status" in error && error.status === 400,
    );

    globalThis.fetch = async () => new Response("temporary outage", { status: 503 });
    await assert.rejects(
      () => getOnePageMedia("00000000-0000-4000-8000-000000000000", "0.webp"),
      (error: unknown) => error instanceof Error && "status" in error && error.status === 503,
    );

    globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/webp" } });
    const media = await getOnePageMedia("00000000-0000-4000-8000-000000000000", "0.webp");
    assert.deepEqual(Array.from(media?.data ?? []), [1, 2, 3]);
    assert.equal(media?.contentType, "image/webp");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldMode === undefined) delete process.env.CO_BUILDER_PERSISTENCE; else process.env.CO_BUILDER_PERSISTENCE = oldMode;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
    if (oldBucket === undefined) delete process.env.SUPABASE_SNAPSHOT_BUCKET; else process.env.SUPABASE_SNAPSHOT_BUCKET = oldBucket;
  }
});
