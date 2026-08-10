import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAnnuityPayment,
  calculateTrancheMortgage,
  type TrancheMortgageInput,
} from "./calculate-tranche-mortgage.ts";

const DOMCLICK_FIRST_PAYMENT = 64_901;
const DOMCLICK_SECOND_PAYMENT = 227_970;

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

function impliedAnnualRate(principal: number, termMonths: number, payment: number) {
  let lower = 0;
  let upper = 100;

  for (let index = 0; index < 100; index += 1) {
    const middle = (lower + upper) / 2;
    if (calculateAnnuityPayment(principal, middle, termMonths) < payment) lower = middle;
    else upper = middle;
  }

  return (lower + upper) / 2;
}

function isLeapYear(year: number) {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

function addMonths(source: Date, months: number) {
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(source.getUTCDate(), lastDay)));
}

function actualActualAnnuity(
  principal: number,
  annualRate: number,
  startDate: string,
  termMonths: number,
) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const factors: number[] = [];
  let previous = start;

  for (let month = 1; month <= termMonths; month += 1) {
    const current = addMonths(start, month);
    const days = (current.getTime() - previous.getTime()) / 86_400_000;
    const daysInYear = isLeapYear(previous.getUTCFullYear()) ? 366 : 365;
    factors.push(1 + annualRate / 100 * days / daysInYear);
    previous = current;
  }

  const accumulatedPrincipal = factors.reduce(
    (value, factor) => value * factor,
    principal,
  );
  const paymentAccumulator = factors.reduceRight(
    (state, factor) => ({
      futureFactor: state.futureFactor * factor,
      denominator: state.denominator + state.futureFactor,
    }),
    { futureFactor: 1, denominator: 0 },
  );

  return accumulatedPrincipal / paymentAccumulator.denominator;
}

test("control case uses the contractual annuity formula and remaining term", () => {
  const result = calculateTrancheMortgage(controlCase);

  assert.equal(result.isBalanced, true);
  assert.equal(result.loanAmount, 13_980_000);
  assert.equal(result.stages[0].remainingTermMonths, 360);
  assert.equal(result.stages[0].paymentCount, 24);
  assert.equal(result.stages[0].monthlyPayment, 63_890.72);
  assert.equal(result.stages[1].remainingTermMonths, 336);
  assert.equal(result.stages[1].monthlyPayment, 224_666.85);
});

test("Domclick figures remain an explicit external benchmark, not a fitted constant", () => {
  const result = calculateTrancheMortgage(controlCase);
  const firstDifference = DOMCLICK_FIRST_PAYMENT - result.stages[0].monthlyPayment;
  const secondDifference = DOMCLICK_SECOND_PAYMENT - result.stages[1].monthlyPayment;

  assert.equal(Math.round(firstDifference * 100) / 100, 1_010.28);
  assert.equal(Math.round(secondDifference * 100) / 100, 3_303.15);
  assert.ok(Math.abs(impliedAnnualRate(3_980_000, 360, DOMCLICK_FIRST_PAYMENT) - 19.5092) < 0.0001);
  assert.ok(Math.abs(impliedAnnualRate(result.stages[1].outstandingAfterIssue, 336, DOMCLICK_SECOND_PAYMENT) - 19.4895) < 0.0001);
});

test("full original term and Actual/Actual day count do not reproduce Domclick", () => {
  const result = calculateTrancheMortgage(controlCase);
  const secondPaymentWithFullTerm = calculateAnnuityPayment(
    result.stages[1].outstandingAfterIssue,
    controlCase.annualRate,
    360,
  );
  const dailyPayment = actualActualAnnuity(
    controlCase.tranches[0].amount,
    controlCase.annualRate,
    controlCase.transactionDate,
    360,
  );

  assert.equal(secondPaymentWithFullTerm, 224_322.13);
  assert.ok(Math.abs(dailyPayment - 63_898.34) < 0.01);
  assert.ok(Math.abs(dailyPayment - DOMCLICK_FIRST_PAYMENT) > 1_000);
});
