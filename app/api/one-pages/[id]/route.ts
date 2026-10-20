import { NextResponse } from "next/server";
import { validateSnapshotId } from "../../../lib/api-security";
import { getOnePageSnapshot } from "../../../lib/one-page-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!validateSnapshotId(id)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const snapshot = await getOnePageSnapshot(id);
  return snapshot
    ? NextResponse.json({ snapshot }, { headers: { "cache-control": "private, no-store" } })
    : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
