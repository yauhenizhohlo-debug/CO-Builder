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
    specialistContacts: { firstName: "Анна", lastName: "Петрова", agency: "Очень длинное название агентства недвижимости", phone: "+7 900 000-00-00" },
    specialistContactsMode: "enabled" as const,
  };
  const snapshot = createProposalSnapshot(proposal, "snapshot-1", "2026-01-01T00:00:00.000Z");
  proposal.schedule[1].amount = 1;
  proposal.specialistContacts.agency = "Изменено";
  assert.equal(snapshot.proposal.financingType, "installment");
  assert.equal(snapshot.proposal.schedule[1].amount, 700);
  assert.equal(snapshot.proposal.financingType === "installment" ? snapshot.proposal.scheduleBalanceMode : null, "auto");
  assert.equal(snapshot.proposal.financingType === "installment" ? snapshot.proposal.scheduleBalancerId : null, "b");
  assert.equal(snapshot.proposal.specialistContacts?.agency, "Очень длинное название агентства недвижимости");
  assert.equal(snapshot.proposal.specialistContactsMode, "enabled");
});

test("free schedule snapshot preserves arbitrary stages without standard dates", () => {
  const proposal = {
    financingType: "installment" as const,
    room: { roomNumber: "704", floor: 7, area: 38, pricePerSqm: 605000, price: 22990000, layoutId: "page-18", renderSetId: "room-38" },
    installment: { listPrice: 1000, discountedPrice: 1000, discountPercent: 0, discountAmount: 0, initialPaymentPercent: 0, initialPayment: 0, monthlyPayment: 0, firstPeriodPaymentCount: 0, paymentsBeforeTopUp: 0, targetEscrow: 500, topUpPayment: 0, secondPeriodPaymentCount: 11, secondPeriodPayments: 0, finalPayment: 1000 },
    scheduleMode: "custom" as const,
    scheduleBalanceMode: "manual" as const,
    scheduleBalancerId: "second",
    scheduleValidationErrors: [],
    schedule: [
      { id: "first", date: "2027-03-14", type: "initial" as const, label: "Первый этап", amount: 100, cumulativeAmount: 100 },
      { id: "second", date: "2029-02-11", type: "top-up" as const, label: "Остаток", amount: 900, cumulativeAmount: 1000 },
    ],
    specialistContactsMode: "none" as const,
  };
  const snapshot = createProposalSnapshot(proposal);
  assert.equal(snapshot.proposal.financingType, "installment");
  if (snapshot.proposal.financingType !== "installment") return;
  assert.deepEqual(snapshot.proposal.schedule.map((row) => row.date), ["2027-03-14", "2029-02-11"]);
  assert.equal(snapshot.proposal.schedule.some((row) => row.date === "2027-06-30"), false);
});

test("legacy proposal snapshots remain valid without specialist contacts", () => {
  const proposal = {
    financingType: "mortgage" as const,
    room: { roomNumber: "704", floor: 7, area: 38, pricePerSqm: 605000, price: 22990000, layoutId: "page-18", renderSetId: "room-38" },
    mortgage: { price: 1000, initialPayment: 300, initialPaymentPercent: 30, loanAmount: 700, annualRate: 10, termYears: 30, termMonths: 360, trancheTotal: 700, difference: 0, remainingBalance: 700, totalInterest: 0, totalPayments: 0, stages: [], schedule: [], isBalanced: true, validationMessages: [] },
  };
  assert.equal(createProposalSnapshot(proposal).proposal.specialistContacts, undefined);
});
