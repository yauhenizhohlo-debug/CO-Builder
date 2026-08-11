import { NextResponse } from "next/server";
import { validateImportedContext } from "../../../lib/validate-imported-context";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const base = process.env.INVENTORY_API_URL;
  const token = process.env.PROPOSAL_BUILDER_TOKEN;
  if (!base || !token) {
    console.error("inventory_api_unreachable");
    return NextResponse.json({ error: "INVENTORY_API_UNAVAILABLE" }, { status: 503 });
  }

  try {
    const { id } = await params;
    const response = await fetch(
      `${base.replace(/\/$/, "")}/api/proposal-contexts/${encodeURIComponent(id)}`,
      { cache: "no-store", headers: { authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      return new NextResponse(await response.text(), {
        status: response.status,
        headers: { "content-type": "application/json" },
      });
    }
    return NextResponse.json(validateImportedContext(await response.json()));
  } catch (error) {
    if (error instanceof Error && (
      error.message.startsWith("INVALID_PROPOSAL_CONTEXT")
      || error.message.startsWith("UNSUPPORTED_PROPOSAL_CONTEXT")
    )) {
      console.error("inventory_context_invalid", error.message);
      return NextResponse.json({ error: "INVALID_PROPOSAL_CONTEXT" }, { status: 502 });
    }
    console.error("inventory_api_unreachable");
    return NextResponse.json({ error: "INVENTORY_API_UNAVAILABLE" }, { status: 503 });
  }
}
