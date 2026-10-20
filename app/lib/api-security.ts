import "server-only";

import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { isSupabasePersistence } from "./persistence-config.ts";
import { supabaseRpc } from "./supabase-persistence.ts";

export const SNAPSHOT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_LIMITS = new Map<string, { count: number; resetAt: number }>();

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function validateSnapshotId(id: string) {
  return SNAPSHOT_ID_PATTERN.test(id);
}

export function validateMediaFileName(fileName: string) {
  return /^(?:0|[1-9][0-9]?)\.(?:jpg|jpeg|png|webp)$/i.test(fileName);
}

export async function readLimitedJson(request: Request, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw new ApiRequestError("REQUEST_TOO_LARGE", 413);
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) throw new ApiRequestError("REQUEST_TOO_LARGE", 413);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ApiRequestError("INVALID_JSON", 400);
  }
}

export function assertSafeJson(value: unknown, options: { maxDepth?: number; maxArrayLength?: number; maxStringLength?: number } = {}) {
  const maxDepth = options.maxDepth ?? 12;
  const maxArrayLength = options.maxArrayLength ?? 480;
  const maxStringLength = options.maxStringLength ?? 4_000;
  let nodes = 0;
  const visit = (item: unknown, depth: number): void => {
    nodes += 1;
    if (nodes > 8_000 || depth > maxDepth) throw new ApiRequestError("INVALID_REQUEST", 400);
    if (item === null || typeof item === "boolean") return;
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new ApiRequestError("INVALID_REQUEST", 400);
      return;
    }
    if (typeof item === "string") {
      if (item.length > maxStringLength) throw new ApiRequestError("INVALID_REQUEST", 400);
      return;
    }
    if (Array.isArray(item)) {
      if (item.length > maxArrayLength) throw new ApiRequestError("INVALID_REQUEST", 400);
      item.forEach((entry) => visit(entry, depth + 1));
      return;
    }
    if (typeof item !== "object") throw new ApiRequestError("INVALID_REQUEST", 400);
    const record = item as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length > 100 || keys.some((key) => key === "__proto__" || key === "constructor" || key === "prototype")) {
      throw new ApiRequestError("INVALID_REQUEST", 400);
    }
    keys.forEach((key) => visit(record[key], depth + 1));
  };
  visit(value, 0);
}

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "local";
  const address = forwarded.split(",")[0]?.trim() || "unknown";
  const secret = process.env.RATE_LIMIT_SECRET || process.env.PRICE_EDITOR_SESSION_SECRET;
  if (!secret && isSupabasePersistence()) throw new Error("RATE_LIMIT_SECRET_NOT_CONFIGURED");
  return createHmac("sha256", secret || "local-development-only").update(address).digest("hex");
}

type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

async function consume(scope: string, key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  if (isSupabasePersistence()) {
    return supabaseRpc<RateLimitResult>("co_builder_consume_rate_limit", {
      p_scope: scope,
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
  }
  const now = Date.now();
  const cacheKey = `${scope}:${key}`;
  const current = LOCAL_LIMITS.get(cacheKey);
  if (!current || current.resetAt <= now) {
    LOCAL_LIMITS.set(cacheKey, { count: 1, resetAt: now + windowSeconds * 1_000 });
    return { allowed: true, retryAfterSeconds: windowSeconds };
  }
  current.count += 1;
  return { allowed: current.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)) };
}

export async function enforceRateLimits(request: NextRequest, rules: Array<{ scope: string; limit: number; windowSeconds: number; global?: boolean }>) {
  const key = clientKey(request);
  for (const rule of rules) {
    const result = await consume(rule.scope, rule.global ? "global" : key, rule.limit, rule.windowSeconds);
    if (!result.allowed) {
      const error = new ApiRequestError("RATE_LIMITED", 429);
      Object.assign(error, { retryAfterSeconds: result.retryAfterSeconds });
      throw error;
    }
  }
}

export function apiError(error: unknown) {
  if (error instanceof ApiRequestError) {
    return { code: error.code, status: error.status, retryAfterSeconds: (error as ApiRequestError & { retryAfterSeconds?: number }).retryAfterSeconds };
  }
  if (error instanceof Error && (error.message.startsWith("SUPABASE_") || error.message === "RATE_LIMIT_SECRET_NOT_CONFIGURED")) {
    return { code: "SECURITY_SERVICE_UNAVAILABLE", status: 503, retryAfterSeconds: undefined };
  }
  return { code: error instanceof Error ? error.message : "REQUEST_FAILED", status: 400, retryAfterSeconds: undefined };
}
