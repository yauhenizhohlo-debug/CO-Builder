import { NextResponse } from "next/server";
import { validateMediaFileName, validateSnapshotId } from "../../../../../lib/api-security";
import { getOnePageMedia } from "../../../../../lib/one-page-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; fileName: string }> }) {
  const { id, fileName } = await params;
  if (!validateSnapshotId(id) || !validateMediaFileName(fileName)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const media = await getOnePageMedia(id, fileName);
  return media
    ? new NextResponse(media.data, { headers: { "content-type": media.contentType, "cache-control": "private, max-age=31536000, immutable" } })
    : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
