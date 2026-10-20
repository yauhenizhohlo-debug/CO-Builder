import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_SESSION_TTL_SECONDS, createAdminSession, validateAdminPassword, validateAdminSession } from "./admin-auth.ts";

test("admin session is signed, expires and rejects tampering", () => {
  const oldPassword = process.env.PRICE_EDITOR_ADMIN_PASSWORD;
  const oldSecret = process.env.PRICE_EDITOR_SESSION_SECRET;
  process.env.PRICE_EDITOR_ADMIN_PASSWORD = "strong-password";
  process.env.PRICE_EDITOR_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  try {
    const now = Date.parse("2026-10-17T12:00:00Z");
    const session = createAdminSession("manager-a", now);
    assert.equal(validateAdminSession(session, now + 1000), "manager-a");
    assert.equal(validateAdminSession(`${session}tampered`, now + 1000), null);
    assert.equal(validateAdminSession(session, now + (ADMIN_SESSION_TTL_SECONDS + 1) * 1000), null);
    assert.equal(validateAdminPassword("strong-password"), true);
    assert.equal(validateAdminPassword("wrong"), false);
  } finally {
    if (oldPassword === undefined) delete process.env.PRICE_EDITOR_ADMIN_PASSWORD; else process.env.PRICE_EDITOR_ADMIN_PASSWORD = oldPassword;
    if (oldSecret === undefined) delete process.env.PRICE_EDITOR_SESSION_SECRET; else process.env.PRICE_EDITOR_SESSION_SECRET = oldSecret;
  }
});
