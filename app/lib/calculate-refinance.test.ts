import assert from "node:assert/strict";
import test from "node:test";
import { calculateRefinance } from "./calculate-refinance.ts";
import {
  calculateTrancheMortgage,
  type MortgageTrancheInput,
} from "./calculate-tranche-mortgage.ts";

const transactionDate = "2026-08-15";

function mortgageFor(
  tranches: MortgageTrancheInput[],
  discountPercent = 0,
) {
  const price = 20_000_000;
  const dealPrice = price * (1 - discountPercent / 100);
  const initialPayment = dealPrice * 0.3;

  return calculateTrancheMortgage({
    price,
    discount: { mode: "percent", value: discountPercent },
    initialPayment,
    annualRate: 19.2,
    termMonths: 360,
    transactionDate,
    tranches,
  });
}

function distributedTranches(discountPercent: number, count: 1 | 2 | 3) {
  const loan = 20_000_000 * (1 - discountPercent / 100) * 0.7;
  if (count === 1) return [{ id: "one", amount: loan, issueMonth: 0 }];
  if (count === 2) return [
    { id: "one", amount: Math.round(loan * 0.3), issueMonth: 0 },
    { id: "two", amount: loan - Math.round(loan * 0.3), issueMonth: 24 },
  ];
  return [
    { id: "one", amount: Math.round(loan * 0.2), issueMonth: 0 },
    { id: "two", amount: Math.round(loan * 0.3), issueMonth: 24 },
    { id: "three", amount: loan - Math.round(loan * 0.2) - Math.round(loan * 0.3), issueMonth: 48 },
  ];
}

test("refinance off leaves the mortgage snapshot unchanged", () => {
  const mortgage = mortgageFor(distributedTranches(0, 2));
  const before = structuredClone(mortgage);
  const result = calculateRefinance({
    enabled: false,
    refinanceAfterMonths: 24,
    assumedAnnualRate: 10,
    transactionDate,
    mortgage,
  });

  assert.deepEqual(mortgage, before);
  assert.equal(result.enabled, false);
  assert.equal(result.outstandingPrincipal, null);
  assert.equal(result.paymentAfterRefinance, null);
});

test("refinance after 24 months uses the actual scheduled balance", () => {
  const mortgage = mortgageFor(distributedTranches(0, 2));
  const result = calculateRefinance({ enabled: true, refinanceAfterMonths: 24, assumedAnnualRate: 10, transactionDate, mortgage });

  assert.equal(result.refinanceDate, "2028-08-15");
  assert.equal(result.remainingTermMonths, 336);
  assert.equal(result.outstandingPrincipal, mortgage.schedule[24].remainingBalance);
  assert.equal(result.paymentBeforeRefinance, Math.floor(mortgage.schedule[23].payment));
  assert.ok((result.paymentAfterRefinance ?? 0) > 0);
});

test("refinance after 12 months uses the twelfth-month balance", () => {
  const mortgage = mortgageFor(distributedTranches(0, 1));
  const result = calculateRefinance({ enabled: true, refinanceAfterMonths: 12, assumedAnnualRate: 10, transactionDate, mortgage });

  assert.equal(result.refinanceDate, "2027-08-15");
  assert.equal(result.outstandingPrincipal, mortgage.schedule[12].remainingBalance);
  assert.equal(result.remainingTermMonths, 348);
});

test("outstanding principal comes from amortization and is below original principal", () => {
  const mortgage = mortgageFor(distributedTranches(0, 1));
  const result = calculateRefinance({ enabled: true, refinanceAfterMonths: 24, assumedAnnualRate: 10, transactionDate, mortgage });

  assert.ok((result.outstandingPrincipal ?? Infinity) < mortgage.loanAmount);
});

test("zero future rate divides principal by the remaining term", () => {
  const mortgage = mortgageFor(distributedTranches(0, 1));
  const result = calculateRefinance({ enabled: true, refinanceAfterMonths: 24, assumedAnnualRate: 0, transactionDate, mortgage });

  assert.equal(
    result.paymentAfterRefinance,
    Math.round(((result.outstandingPrincipal ?? 0) / result.remainingTermMonths) * 100) / 100,
  );
});

test("refinance at or after loan maturity returns validation instead of a payment", () => {
  const mortgage = mortgageFor(distributedTranches(0, 1));
  const result = calculateRefinance({ enabled: true, refinanceAfterMonths: 360, assumedAnnualRate: 10, transactionDate, mortgage });

  assert.equal(result.isValid, false);
  assert.equal(result.paymentAfterRefinance, null);
  assert.match(result.validationMessages.join(" "), /до окончания кредита/);
});

test("discounted principal is the source for refinance across one, two and three tranches", () => {
  for (const count of [1, 2, 3] as const) {
    const mortgage = mortgageFor(distributedTranches(3, count), 3);
    const result = calculateRefinance({ enabled: true, refinanceAfterMonths: 24, assumedAnnualRate: 10, transactionDate, mortgage });

    assert.equal(mortgage.price, 19_400_000);
    assert.equal(mortgage.loanAmount, 13_580_000);
    assert.equal(mortgage.stages.length, count);
    assert.equal(result.isValid, true);
    assert.ok((result.outstandingPrincipal ?? 0) > 0);
    assert.ok((result.outstandingPrincipal ?? Infinity) < mortgage.loanAmount);
    assert.ok((result.paymentAfterRefinance ?? 0) > 0);
  }
});
