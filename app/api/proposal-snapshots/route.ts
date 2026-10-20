import { NextRequest, NextResponse } from "next/server";
import { apiError, enforceRateLimits, readLimitedJson } from "../../lib/api-security";
import { createProposalSnapshot } from "../../lib/proposal-snapshot";
import { saveProposalSnapshot } from "../../lib/proposal-snapshot-store";
import { validateProposalData } from "../../lib/snapshot-validation";

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimits(request, [
      { scope: "proposal-snapshot-hour", limit: 20, windowSeconds: 3_600 },
      { scope: "snapshot-global-day", limit: 500, windowSeconds: 86_400, global: true },
    ]);
    const body = validateProposalData(await readLimitedJson(request, 2 * 1024 * 1024));
    const snapshot = await saveProposalSnapshot(createProposalSnapshot(body));
    return NextResponse.json({ snapshot });
  } catch (error) {
    const result = apiError(error);
    return NextResponse.json({ error: result.code }, {
      status: result.status,
      headers: result.retryAfterSeconds ? { "retry-after": String(result.retryAfterSeconds) } : undefined,
    });
  }
}
