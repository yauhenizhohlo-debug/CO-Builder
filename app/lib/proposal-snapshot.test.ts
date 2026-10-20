import assert from "node:assert/strict";
import test from "node:test";
import { createProposalSnapshot } from "./proposal-snapshot.ts";

test("freezes a custom installment schedule", () => {
  const proposal = {
    financingType: "installment" as const,
    room: { roomNumber: "704", floor: 7, area: 38, pricePerSqm: 605000, price: 22990000, layoutId: "page-18", renderSetId: "room-38" },
    installment: { listPrice: 1000, discountedPrice: 1000, discountPercent: 0, discountAmount: 0, initialPaymentPercent: 30, initialPayment: 300, monthlyPayment: 0, firstPeriodPaymentCount: 0, paymentsBeforeTopUp: 0, targetEscrow: 500, topUpPayment: 0, secondPeriodPaymentCount: 11, secondPeriodPayments: 0, finalPayment: 700 },
    scheduleMode: "custom" as const,
    scheduleBalanceMode: "auto" as const,
    scheduleBalancerId: "b",
    scheduleValidationErrors: [],
    schedule: [{ id: "a", date: "2026-01-01", type: "initial" as const, label: "Первоначальный взнос", amount: 300, cumulativeAmount: 300 }, { id: "b", date: "2027-01-01", type: "final" as const, label: "Финальный платёж", amount: 700, cumulativeAmount: 1000 }],
  };
  const snapshot = createProposalSnapshot(proposal, "snapshot-1", "2026-01-01T00:00:00.000Z");
  proposal.schedule[1].amount = 1;
  assert.equal(snapshot.proposal.financingType, "installment");
  assert.equal(snapshot.proposal.schedule[1].amount, 700);
  assert.equal(snapshot.proposal.financingType === "installment" ? snapshot.proposal.scheduleBalanceMode : null, "auto");
  assert.equal(snapshot.proposal.financingType === "installment" ? snapshot.proposal.scheduleBalancerId : null, "b");
});
