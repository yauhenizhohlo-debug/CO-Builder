import {
  parseProposalContextResponse,
  type ProposalContextResponse,
} from "@cosmos/proposal-contract";

export type ImportedContextWarning = "PRICE_CHANGED" | "STATUS_CHANGED";

export function validateImportedContext(value: unknown) {
  const parsed = parseProposalContextResponse(value);
  if (typeof value === "object" && value !== null && "data" in value) {
    const data = (value as { data?: unknown }).data;
    if (typeof data === "object" && data !== null) {
      const sourceApp = (data as { sourceApp?: unknown }).sourceApp;
      const returnUrl = (data as { returnUrl?: unknown }).returnUrl;
      if (sourceApp !== undefined && sourceApp !== "COSMOS_INVENTORY") throw new Error("INVALID_PROPOSAL_CONTEXT:data.sourceApp");
      if (returnUrl !== undefined && typeof returnUrl !== "string") throw new Error("INVALID_PROPOSAL_CONTEXT:data.returnUrl");
      parsed.data.sourceApp = sourceApp as "COSMOS_INVENTORY" | undefined;
      parsed.data.returnUrl = returnUrl;
    }
  }
  return parsed;
}

export function warnings(value: ProposalContextResponse): ImportedContextWarning[] {
  const result: ImportedContextWarning[] = [];
  if (value.liveCheck.priceChanged) result.push("PRICE_CHANGED");
  if (value.liveCheck.statusChanged) result.push("STATUS_CHANGED");
  return result;
}
