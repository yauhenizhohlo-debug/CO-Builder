import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "co_builder_admin";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

function configured() {
  return Boolean(process.env.PRICE_EDITOR_ADMIN_PASSWORD && process.env.PRICE_EDITOR_SESSION_SECRET);
}

function signature(authorId: string, issuedAt: string) {
  return createHmac("sha256", process.env.PRICE_EDITOR_SESSION_SECRET || "disabled").update(`${authorId}.${issuedAt}`).digest("hex");
}

export function createAdminSession(authorId: string, now = Date.now()) {
  if (!configured()) throw new Error("ADMIN_AUTH_NOT_CONFIGURED");
  const issuedAt = String(Math.floor(now / 1000));
  return `${Buffer.from(authorId, "utf8").toString("base64url")}.${issuedAt}.${signature(authorId, issuedAt)}`;
}

export function validateAdminPassword(password: string) {
  const expected = process.env.PRICE_EDITOR_ADMIN_PASSWORD;
  if (!expected) return false;
  const left = Buffer.from(password);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function validateAdminSession(raw: string | undefined, now = Date.now()) {
  if (!raw || !configured()) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [encodedAuthor, issuedAt, suppliedSignature] = parts;
  const issuedAtNumber = Number(issuedAt);
  const nowSeconds = Math.floor(now / 1000);
  if (!Number.isSafeInteger(issuedAtNumber) || issuedAtNumber > nowSeconds + 60 || nowSeconds - issuedAtNumber > ADMIN_SESSION_TTL_SECONDS) return null;
  const authorId = Buffer.from(encodedAuthor, "base64url").toString("utf8");
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(signature(authorId, issuedAt));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected) ? authorId : null;
}

export function getAdminAuthor(request: NextRequest) {
  return validateAdminSession(request.cookies.get(ADMIN_COOKIE)?.value);
}
