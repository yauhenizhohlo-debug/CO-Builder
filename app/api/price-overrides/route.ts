import { NextRequest, NextResponse } from "next/server";
import { getAdminAuthor } from "../../lib/admin-auth";
import { apiError, enforceRateLimits, readLimitedJson } from "../../lib/api-security";
import { getPriceHistory, savePriceOverride } from "../../lib/price-overrides";

export async function GET(request: NextRequest) {
  if (!getAdminAuthor(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const roomNumber = request.nextUrl.searchParams.get("roomNumber") || undefined;
  if (roomNumber && (roomNumber.length > 20 || !/^[№0-9\p{L}-]+$/u.test(roomNumber))) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  return NextResponse.json({ history: await getPriceHistory(roomNumber) });
}

export async function POST(request: NextRequest) {
  const authorId = getAdminAuthor(request);
  if (!authorId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    await enforceRateLimits(request, [{ scope: "price-write-hour", limit: 30, windowSeconds: 3_600 }]);
    const body = await readLimitedJson(request, 16 * 1024) as { roomNumber?: unknown; newPrice?: unknown; comment?: unknown; expectedPrice?: unknown } | null;
    if (!body || typeof body !== "object" || typeof body.roomNumber !== "string" || body.roomNumber.length > 20
      || typeof body.newPrice !== "number" || !Number.isSafeInteger(body.newPrice)
      || typeof body.comment !== "string" || body.comment.length > 500
      || (body.expectedPrice !== undefined && (typeof body.expectedPrice !== "number" || !Number.isSafeInteger(body.expectedPrice)))) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    return NextResponse.json(await savePriceOverride({ roomNumber: body.roomNumber, newPrice: body.newPrice, comment: body.comment, authorId, expectedPrice: typeof body.expectedPrice === "number" ? body.expectedPrice : undefined }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "SAVE_FAILED";
    const detail = error && typeof error === "object" && "detail" in error ? String(error.detail) : "";
    if (`${message}:${detail}`.includes("PRICE_CONFLICT")) return NextResponse.json({ error: "PRICE_CONFLICT" }, { status: 409 });
    const result = apiError(error);
    return NextResponse.json({ error: result.code }, {
      status: result.status,
      headers: result.retryAfterSeconds ? { "retry-after": String(result.retryAfterSeconds) } : undefined,
    });
  }
}
