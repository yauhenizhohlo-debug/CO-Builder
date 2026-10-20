import type { ProposalData } from "../components/proposal-context.tsx";

export type ProposalSnapshot = {
  id: string;
  createdAt: string;
  version: 1;
  proposal: ProposalData;
};

export function createProposalSnapshot(proposal: ProposalData, id = crypto.randomUUID(), createdAt = new Date().toISOString()): ProposalSnapshot {
  if (proposal.financingType === "installment" && (proposal.scheduleValidationErrors?.length ?? 0) > 0) {
    throw new Error("INVALID_PAYMENT_SCHEDULE");
  }
  return { id, createdAt, version: 1, proposal: structuredClone(proposal) };
}
