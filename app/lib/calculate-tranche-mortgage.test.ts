import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateStagePayment,
  calculateTrancheMortgage,
  type MortgagePayment,
  type TrancheMortgageInput,
} from "./calculate-tranche-mortgage.ts";

const controlCase: TrancheMortgageInput = {
  price: 20_000_000,
  initialPayment: 6_020_000,
  annualRate: 19.2,
  termMonths: 360,
  transactionDate: "2026-08-15",
  tranches: [
    { id: "tranche-1", amount: 3_980_000, issueMonth: 0 },
    { id: "tranche-2", amount: 10_000_000, issueMonth: 24 },
  ],
};

function approximately(actual: number, expected: number, tolerance = 2) {
  assert.ok(
    Math.abs(Math.round(actual) - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} ₽ of ${expected}`,
  );
}

function assertPayment(
  actual: MortgagePayment,
  expected: Partial<Record<keyof MortgagePayment, number>>,
) {
  for (const [field, value] of Object.entries(expected)) {
    approximately(actual[field as keyof MortgagePayment] as number, value);
  }
}

test("stage payment is the unrounded 31-day interest on nominal issued credit", () => {
  approximately(calculateStagePayment(3_980_000, 19.2), 64_901);
  approximately(calculateStagePayment(13_980_000, 19.2), 227_969);
});

test("first Domclick stage uses Actual/365 and retains hidden kopecks", () => {
  const result = calculateTrancheMortgage(controlCase);

  assert.equal(result.isBalanced, true);
  assert.equal(result.schedule[0].date, "2026-08-15");
  assertPayment(result.schedule[0], {
    payment: 64_901,
    interest: 64_901,
    principal: 0,
    remainingBalance: 3_980_000,
  });
  assertPayment(result.schedule[1], {
    payment: 64_901,
    interest: 64_901,
    principal: 0,
    remainingBalance: 3_980_000,
  });
  assertPayment(result.schedule[2], {
    payment: 64_901,
    interest: 62_807,
    principal: 2_093,
    remainingBalance: 3_977_906,
  });
  assertPayment(result.schedule[3], {
    payment: 64_901,
    interest: 64_867,
    principal: 34,
    remainingBalance: 3_977_872,
  });
});

test("a new tranche is added to the reduced balance and resets stage payment", () => {
  const result = calculateTrancheMortgage(controlCase);
  const beforeSecondTranche = result.schedule[23].remainingBalance;
  const firstSecondStagePayment = result.schedule[24];

  assert.ok(beforeSecondTranche < 3_980_000);
  approximately(result.stages[1].outstandingAfterIssue, beforeSecondTranche + 10_000_000);
  assert.equal(result.stages[0].monthlyPayment, 64_901);
  assert.equal(result.stages[1].monthlyPayment, 227_969);
  assert.equal(firstSecondStagePayment.activeTranche, 2);
});

test("one, two and three tranches share the same schedule engine", () => {
  for (const tranches of [
    [{ id: "one", amount: 13_980_000, issueMonth: 0 }],
    controlCase.tranches,
    [
      { id: "one", amount: 3_980_000, issueMonth: 0 },
      { id: "two", amount: 5_000_000, issueMonth: 24 },
      { id: "three", amount: 5_000_000, issueMonth: 48 },
    ],
  ]) {
    const result = calculateTrancheMortgage({ ...controlCase, tranches });
    assert.equal(result.stages.length, tranches.length);
    assert.ok(result.schedule.length > 0);
    assert.ok(result.schedule.length <= 360);
    assert.ok(result.schedule.every((payment) => payment.principal >= 0));
    assert.ok(result.schedule.every((payment) => payment.remainingBalance >= 0));
  }
});

test("published second-stage rows cannot be derived exactly from the supplied rounded balance", () => {
  const suppliedOpeningBalance = 3_946_351 + 10_000_000;
  const impliedDays = 226_792 * 365 / (suppliedOpeningBalance * 0.192);

  // An Actual/365 calendar period contains an integer number of days. This
  // regression guard prevents hiding the unexplained bank adjustment in a
  // fitted coefficient.
  assert.ok(Math.abs(impliedDays - Math.round(impliedDays)) > 0.08);
  assert.ok(Math.abs(impliedDays - 30.9143) < 0.0001);
});
