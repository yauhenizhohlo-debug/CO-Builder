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

function standardMortgageResponse():ProposalContextResponse {const value=baseResponse();value.data.schemaVersion=3;value.data.purchaseScenarioId="33333333-3333-4333-8333-333333333333";value.data.payment={mode:"MORTGAGE",inputs:{mode:"MORTGAGE",downPaymentPercent:30,annualRatePercent:"19.2",termYears:30},result:{purchasePrice:money(2_299_000_000),downPayment:money(689_700_000),loanAmount:money(1_609_300_000),annualRatePercent:"19.2",loanTermMonths:360,monthlyPayment:money(26_242_600),totalPayment:money(9_447_336_000),overpayment:money(7_838_036_000),validationMessages:[]}};return value}

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
  const invalidVersion: unknown = { ...baseResponse(), data: { ...baseResponse().data, schemaVersion: 4 } };
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

test("canonical v2 ProposalContext restores deal price, tranches, refinance and investment losslessly",()=>{const value=baseResponse();if(value.data.payment.mode!=="TRANCHE_MORTGAGE")assert.fail("Expected tranche mortgage");Object.assign(value.data.payment.inputs,{discountPercent:"3",tranches:[{index:1,date:"2026-08-15",amount:468_306_300},{index:2,date:"2028-08-15",amount:1_092_714_700}],refinance:{enabled:true,refinanceAfterMonths:24,assumedAnnualRate:"10"}});Object.assign(value.data.payment.result,{purchasePrice:money(2_230_030_000),downPayment:money(669_009_000),loanAmount:money(1_561_021_000),trancheTotal:money(1_561_021_000),basePrice:money(2_299_000_000),discountPercent:"3",discountAmount:money(68_970_000),dealPrice:money(2_230_030_000),downPaymentAmount:money(669_009_000),annualRate:"19.2",termMonths:360,loanPrincipal:money(1_561_021_000),tranches:[{index:1,date:"2026-08-15",amount:money(468_306_300),percentage:"30",paymentAfterTranche:money(7_636_600)},{index:2,date:"2028-08-15",amount:money(1_092_714_700),percentage:"70",paymentAfterTranche:money(25_455_300)}],refinance:{enabled:true,refinanceAfterMonths:24,refinanceDate:"2028-08-15",assumedAnnualRate:"10",outstandingPrincipal:money(1_557_137_159),remainingTermMonths:336,paymentBeforeRefinance:money(7_636_600),paymentAfterRefinance:money(13_826_761)}});value.data.investment={model:"UNIT_ROOM",scenario:"BASE",inputs:{model:"UNIT_ROOM",scenario:"BASE",taxRatePercent:"0",forecastYears:5,adrYear1:1,occupancyYear1Percent:"60",adrYear2:1,occupancyYear2Percent:"65",annualAdrGrowthRatePercent:"10",occupancyYear3PlusPercent:"65",annualCapitalGrowthRatePercent:"7"},result:{scenarioLabel:"Базовый",firstYearIncome:1_200_000,firstYearYield:5.2,horizonYears:10}};const parsed=validateImportedContext(value);const mapped=mapImportedProposal(parsed.data);assert.equal(mapped.financingType,"mortgage");if(mapped.financingType!=="mortgage")assert.fail("Expected mortgage");assert.equal(mapped.mortgage.basePrice,22_990_000);assert.equal(mapped.mortgage.price,22_300_300);assert.equal(mapped.mortgage.initialPayment,6_690_090);assert.equal(mapped.mortgage.loanAmount,15_610_210);assert.deepEqual(mapped.mortgage.stages.map(stage=>stage.trancheAmount),[4_683_063,10_927_147]);assert.equal(mapped.refinance?.paymentAfterRefinance,138_267.61);assert.equal(mapped.investment?.scenarioLabel,"Базовый")});

test("canonical ProposalContext rejects malformed canonical Money",()=>{const value=baseResponse();if(value.data.payment.mode!=="TRANCHE_MORTGAGE")assert.fail("Expected tranche mortgage");Object.assign(value.data.payment.result,{basePrice:2.5,dealPrice:money(1)});assert.throws(()=>validateImportedContext(value),/INVALID_PROPOSAL_CONTEXT/)});

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

test("standard mortgage v3 snapshot maps without legacy recalculation",()=>{const parsed=validateImportedContext(standardMortgageResponse());assert.equal(parsed.data.purchaseScenarioId,"33333333-3333-4333-8333-333333333333");const mapped=mapImportedProposal(parsed.data);assert.equal(mapped.financingType,"mortgage");if(mapped.financingType!=="mortgage")assert.fail("Expected mortgage");assert.equal(mapped.mortgageKind,"standard");assert.equal(mapped.mortgage.loanAmount,16_093_000);assert.equal(mapped.standardMonthlyPayment,262_426);assert.equal(mapped.mortgage.stages.length,0)});

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
