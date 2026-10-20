import assert from "node:assert/strict";
import test from "node:test";
import { ApiRequestError, assertSafeJson, enforceRateLimits, readLimitedJson, validateMediaFileName, validateSnapshotId } from "./api-security.ts";

test("snapshot identifiers and media names are strict capabilities", () => {
  assert.equal(validateSnapshotId("a5ffae20-c28c-4c97-a9a0-3ebef42f57d6"), true);
  assert.equal(validateSnapshotId("stable-id"), false);
  assert.equal(validateSnapshotId("../../etc/passwd"), false);
  assert.equal(validateMediaFileName("0.webp"), true);
  assert.equal(validateMediaFileName("../0.webp"), false);
  assert.equal(validateMediaFileName("100.webp"), false);
});

test("request parser rejects oversized bodies before persistence", async () => {
  const request = new Request("http://local.test/api", { method: "POST", body: JSON.stringify({ value: "123456" }) });
  await assert.rejects(() => readLimitedJson(request, 4), (error: unknown) => error instanceof ApiRequestError && error.status === 413);
});

test("safe JSON validation rejects prototype keys and excessive arrays", () => {
  assert.throws(() => assertSafeJson(JSON.parse('{"__proto__":{"admin":true}}')), /INVALID_REQUEST/);
  assert.throws(() => assertSafeJson(new Array(481).fill(1)), /INVALID_REQUEST/);
});

test("local limiter blocks the sixth admin attempt in one window", async () => {
  const makeRequest = () => new Request("http://local.test/api/admin/session", { headers: { "x-forwarded-for": "192.0.2.10" } }) as Parameters<typeof enforceRateLimits>[0];
  for (let index = 0; index < 5; index += 1) await enforceRateLimits(makeRequest(), [{ scope: "test-admin", limit: 5, windowSeconds: 900 }]);
  await assert.rejects(
    () => enforceRateLimits(makeRequest(), [{ scope: "test-admin", limit: 5, windowSeconds: 900 }]),
    (error: unknown) => error instanceof ApiRequestError && error.status === 429,
  );
});
