import {
  parseProposalContextResponse,
  type ProposalContextResponse,
} from "@cosmos/proposal-contract";

export type ImportedContextWarning = "PRICE_CHANGED" | "STATUS_CHANGED";

export function validateImportedContext(value: unknown) {
  return parseProposalContextResponse(value);
}

export function warnings(value: ProposalContextResponse): ImportedContextWarning[] {
  const result: ImportedContextWarning[] = [];
  if (value.liveCheck.priceChanged) result.push("PRICE_CHANGED");
  if (value.liveCheck.statusChanged) result.push("STATUS_CHANGED");
  return result;
}
