import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import type {
  Money,
  ProposalContextResponse,
} from "@cosmos/proposal-contract";
import { mapImportedProposal } from "./map-imported-proposal.ts";
import { formatMoney, moneyToRubles } from "./proposal-money.ts";
import { validateImportedContext, warnings } from "./validate-imported-context.ts";
import { safeInventoryReturnUrl } from "./inventory-return-url.ts";

const money = (value: number) => value as Money;

function baseResponse(): ProposalContextResponse {
  return {
    data: {
      id: "11111111-1111-4111-8111-111111111111",
      projectId: "cosmos-black-sea",
      unitId: "CBS-B1-704",
      schemaVersion: 1,
      paymentEngineVersion: "1.0.0",
      investmentEngineVersion: "1.0.0",
      createdAt: "2026-08-10T09:00:00.000Z",
      expiresAt: null,
      unitSnapshot: {
        unitId: "CBS-B1-704",
        unitNumber: "704",
        floor: 7,
        area: 38,
        price: 22_990_000,
        pricePerSqm: 605_000,
        status: "AVAILABLE",
        viewType: "Море",
        capturedAt: "2026-08-10T09:00:00.000Z",
      },
      payment: {
        mode: "TRANCHE_MORTGAGE",
        inputs: {
          mode: "TRANCHE_MORTGAGE",
          startDate: "2026-08-15",
          downPaymentPercent: 30,
          annualRatePercent: "19.2",
          termYears: 30,
          trancheCount: 2,
        },
        result: {
          purchasePrice: money(2_299_000_000),
          downPayment: money(689_700_000),
          loanAmount: money(1_609_300_000),
          annualRatePercent: "19.2",
          loanTermMonths: 360,
          trancheTotal: money(1_609_300_000),
          difference: money(0),
          isBalanced: true,
          validationMessages: [],
          stages: [
            {
              trancheId: "tranche-1",
              trancheNumber: 1,
              trancheAmount: money(482_790_000),
              issueDate: "2026-08-15",
              paymentCount: 24,
              outstandingAfterIssue: money(482_790_000),
              monthlyPayment: money(7_872_700),
              balanceBeforeNextTranche: money(478_850_000),
            },
            {
              trancheId: "tranche-2",
              trancheNumber: 2,
              trancheAmount: money(1_126_510_000),
              issueDate: "2028-08-15",
              paymentCount: 336,
              outstandingAfterIssue: money(1_605_360_000),
              monthlyPayment: money(26_242_600),
              balanceBeforeNextTranche: money(0),
            },
          ],
          schedule: [
            {
              date: "2026-08-15",
              payment: money(7_872_700),
              interest: money(7_872_700),
              principal: money(0),
              remainingBalance: money(482_790_000),
              activeTranche: 1,
              days: 31,
            },
          ],
          remainingBalance: money(0),
          totalInterest: money(5_000_000_000),
          totalPayments: money(7_299_000_000),
        },
      },
      investment: null,
    },
    liveCheck: {
      priceChanged: false,
      statusChanged: false,
      currentPrice: 22_990_000,
      currentStatus: "AVAILABLE",
    },
  };
}

function installmentResponse(): ProposalContextResponse {
  const value = baseResponse();
  value.data.payment = {
    mode: "INSTALLMENT",
    inputs: { mode: "INSTALLMENT", startDate: "2026-08-10", programId: "cosmos-20" },
    result: {
      purchasePrice: money(2_299_000_000),
      discountedPrice: money(2_253_020_000),
      discountAmount: money(45_980_000),
      downPayment: money(450_604_000),
      downPaymentPercent: "20",
      financedAmount: money(1_802_416_000),
      monthlyPayment: money(10_000_000),
      requiredEscrowAmount: money(1_126_510_000),
      requiredEscrowDate: "2027-06-30",
      keyTopUpPayment: money(575_906_000),
      finalPayment: money(1_016_510_000),
      totalScheduledPayments: money(2_253_020_000),
      remainingBalance: money(0),
      schedule: [
        { id: "down", date: "2026-08-10", type: "DOWN_PAYMENT", label: "Первоначальный взнос", amount: money(450_604_000), cumulativeAmount: money(450_604_000), balanceAfter: money(1_802_416_000) },
        { id: "monthly-1", date: "2026-09-10", type: "MONTHLY", label: "Регулярный платёж 1/1", amount: money(10_000_000), cumulativeAmount: money(460_604_000), balanceAfter: money(1_792_416_000) },
        { id: "top-up", date: "2027-06-30", type: "INTERMEDIATE", label: "Довнос до 50%", amount: money(575_906_000), cumulativeAmount: money(1_036_510_000), balanceAfter: money(1_216_510_000) },
        { id: "monthly-2", date: "2027-07-30", type: "MONTHLY", label: "Платёж второго периода 1/1", amount: money(10_000_000), cumulativeAmount: money(1_046_510_000), balanceAfter: money(1_206_510_000) },
        { id: "final", date: "2028-06-30", type: "FINAL", label: "Финальный платёж", amount: money(1_016_510_000), cumulativeAmount: money(2_063_020_000), balanceAfter: money(190_000_000) },
      ],
    },
  };
  return value;
}

test("Money is consistently converted from kopecks", () => {
  assert.equal(moneyToRubles(money(2_299_000_000)), 22_990_000);
  assert.equal(formatMoney(money(2_299_000_000)), "22 990 000 ₽");
  assert.equal(formatMoney(money(60_500_000)), "605 000 ₽");
});

test("runtime parser accepts the production contract", () => {
  assert.equal(validateImportedContext(baseResponse()).data.unitSnapshot.unitNumber, "704");
});

test("runtime parser rejects malformed money and unsupported versions", () => {
  const invalidMoney: unknown = { ...baseResponse(), data: { ...baseResponse().data, unitSnapshot: { ...baseResponse().data.unitSnapshot, price: 22.9 } } };
  assert.throws(() => validateImportedContext(invalidMoney), /INVALID_PROPOSAL_CONTEXT/);
  const invalidVersion: unknown = { ...baseResponse(), data: { ...baseResponse().data, schemaVersion: 3 } };
  assert.throws(() => validateImportedContext(invalidVersion), /UNSUPPORTED_PROPOSAL_CONTEXT_VERSION/);
});

test("schema v2 preserves a safe Inventory return link and rejects foreign source apps", () => {
  const next: unknown = { ...baseResponse(), data: { ...baseResponse().data, schemaVersion: 2, sourceApp: "COSMOS_INVENTORY", returnUrl: "http://localhost:3001/inventory/cosmos-black-sea/unit/CBS-B1-704" } };
  assert.equal(validateImportedContext(next).data.returnUrl, "http://localhost:3001/inventory/cosmos-black-sea/unit/CBS-B1-704");
  assert.equal(safeInventoryReturnUrl("http://localhost:3001/inventory/cosmos-black-sea/unit/CBS-B1-704"), "http://localhost:3001/inventory/cosmos-black-sea/unit/CBS-B1-704");
  assert.equal(safeInventoryReturnUrl("https://evil.example/inventory/cosmos-black-sea/unit/CBS-B1-704"), null);
  assert.throws(() => validateImportedContext({ ...baseResponse(), data: { ...baseResponse().data, schemaVersion: 2, sourceApp: "EVIL", returnUrl: "http://localhost:3001/inventory/cosmos-black-sea/unit/CBS-B1-704" } }), /sourceApp/);
});

test("tranche mortgage snapshot maps without recalculation", () => {
  const mapped = mapImportedProposal(validateImportedContext(baseResponse()).data);
  assert.equal(mapped.room.price, 22_990_000);
  assert.equal(mapped.room.pricePerSqm, 605_000);
  assert.equal(mapped.room.layoutId, "page-18");
  assert.equal(mapped.room.renderSetId, "room-38");
  assert.equal(mapped.financingType, "mortgage");
  if (mapped.financingType !== "mortgage") assert.fail("Expected mortgage");
  assert.equal(mapped.mortgage.initialPayment, 6_897_000);
  assert.equal(mapped.mortgage.stages[0]?.monthlyPayment, 78_727);
  assert.equal(mapped.mortgage.stages[1]?.monthlyPayment, 262_426);
});

test("installment snapshot maps its own schedule", () => {
  const mapped = mapImportedProposal(validateImportedContext(installmentResponse()).data);
  assert.equal(mapped.financingType, "installment");
  if (mapped.financingType !== "installment") assert.fail("Expected installment");
  assert.equal(mapped.installment.discountedPrice, 22_530_200);
  assert.equal(mapped.installment.initialPayment, 4_506_040);
  assert.equal(mapped.installment.firstPeriodPaymentCount, 1);
  assert.equal(mapped.installment.secondPeriodPayments, 100_000);
  assert.equal(mapped.schedule[3]?.type, "regular-second");
});

test("live warnings stay separate from snapshot values", () => {
  const value = baseResponse();
  value.liveCheck.priceChanged = true;
  value.liveCheck.statusChanged = true;
  value.liveCheck.currentPrice = money(2_500_000_000);
  value.liveCheck.currentStatus = "SOLD";
  const parsed = validateImportedContext(value);
  assert.deepEqual(warnings(parsed), ["PRICE_CHANGED", "STATUS_CHANGED"]);
  assert.equal(parsed.data.unitSnapshot.price, 22_990_000);
});

test("room 704 assets exist for the premium proposal", async () => {
  await access("public/layouts/page-18.webp");
  for (let index = 1; index <= 6; index += 1) {
    await access(`public/renders/room-38/${String(index).padStart(2, "0")}.jpg`);
  }
});
