import { NextRequest, NextResponse } from "next/server";
import { apiError, enforceRateLimits, readLimitedJson } from "../../lib/api-security";
import { createOnePageSnapshot } from "../../lib/one-page";
import { saveOnePageSnapshot } from "../../lib/one-page-store";
import { validateOnePageDraft } from "../../lib/snapshot-validation";

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimits(request, [
      { scope: "one-page-snapshot-hour", limit: 20, windowSeconds: 3_600 },
      { scope: "snapshot-global-day", limit: 500, windowSeconds: 86_400, global: true },
    ]);
    const draft = validateOnePageDraft(await readLimitedJson(request, 512 * 1024));
    return NextResponse.json({ snapshot: await saveOnePageSnapshot(createOnePageSnapshot(draft)) });
  } catch (error) {
    const result = apiError(error);
    return NextResponse.json({ error: result.code }, {
      status: result.status,
      headers: result.retryAfterSeconds ? { "retry-after": String(result.retryAfterSeconds) } : undefined,
    });
  }
}
