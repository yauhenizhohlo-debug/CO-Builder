import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_SESSION_TTL_SECONDS, createAdminSession, getAdminAuthor, validateAdminPassword } from "../../../lib/admin-auth";
import { apiError, enforceRateLimits, readLimitedJson } from "../../../lib/api-security";

export async function GET(request: NextRequest) {
  const authorId = getAdminAuthor(request);
  return NextResponse.json({ authenticated: Boolean(authorId), authorId });
}

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimits(request, [
      { scope: "admin-login-15m", limit: 5, windowSeconds: 900 },
      { scope: "admin-login-day", limit: 50, windowSeconds: 86_400 },
    ]);
    const body = await readLimitedJson(request, 8 * 1024) as { password?: unknown; authorId?: unknown } | null;
    if (!body || typeof body !== "object" || typeof body.password !== "string" || body.password.length > 256 || !validateAdminPassword(body.password)) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const authorId = typeof body.authorId === "string" && body.authorId.trim() ? body.authorId.trim() : "local-admin";
    if (authorId.length > 80 || !/^[\p{L}\p{N} ._@-]+$/u.test(authorId)) return NextResponse.json({ error: "INVALID_AUTHOR" }, { status: 400 });
    const response = NextResponse.json({ authenticated: true, authorId });
    response.cookies.set(ADMIN_COOKIE, createAdminSession(authorId), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ADMIN_SESSION_TTL_SECONDS });
    return response;
  } catch (error) {
    const result = apiError(error);
    return NextResponse.json({ error: result.code }, {
      status: result.status,
      headers: result.retryAfterSeconds ? { "retry-after": String(result.retryAfterSeconds) } : undefined,
    });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
