export const PROPOSAL_CONTEXT_SCHEMA_VERSION = 1;
export const PAYMENT_ENGINE_VERSION = "1.0.0";
export const INVESTMENT_ENGINE_VERSION = "1.0.0";

export type Money = number & { readonly __brand: "MoneyKopecks" };

export type ProposalPaymentInput =
  | { mode: "INSTALLMENT"; startDate: string; programId: string }
  | { mode: "TRANCHE_MORTGAGE"; startDate: string; downPaymentPercent: number; annualRatePercent: string; termYears: number; trancheCount: 1 | 2 | 3 }
  | { mode: "MORTGAGE"; downPaymentPercent: number; annualRatePercent: string; termYears: number };

export type ProposalInvestmentInput =
  | { model: "UNIT_ROOM"; scenario: string; taxRatePercent: string; forecastYears: number; adrYear1: number; occupancyYear1Percent: string; adrYear2: number; occupancyYear2Percent: string; annualAdrGrowthRatePercent: string; occupancyYear3PlusPercent: string; annualCapitalGrowthRatePercent: string }
  | { model: "POOL_AREA_SHARE"; scenario: string; taxRatePercent: string; forecastYears: number; hotelGrossRevenueYear1: number; hotelGrossRevenueYear2: number; annualRevenueGrowthRatePercent: string; annualCapitalGrowthRatePercent: string };

export type ImportedPaymentScheduleItem = {
  id: string;
  date: string;
  type: "DOWN_PAYMENT" | "MONTHLY" | "INTERMEDIATE" | "FINAL";
  label: string;
  amount: Money;
  cumulativeAmount: Money;
  balanceAfter: Money;
};

export type ImportedInstallmentResult = {
  purchasePrice: Money;
  discountedPrice: Money;
  discountAmount: Money;
  downPayment: Money;
  downPaymentPercent: string;
  financedAmount: Money;
  monthlyPayment: Money;
  requiredEscrowAmount: Money;
  requiredEscrowDate: string;
  keyTopUpPayment: Money;
  finalPayment: Money;
  totalScheduledPayments: Money;
  remainingBalance: Money;
  schedule: ImportedPaymentScheduleItem[];
};

export type ImportedTrancheStage = {
  trancheId: string;
  trancheNumber: number;
  trancheAmount: Money;
  issueDate: string;
  paymentCount: number;
  outstandingAfterIssue: Money;
  monthlyPayment: Money;
  balanceBeforeNextTranche: Money;
};

export type ImportedTranchePayment = {
  date: string;
  payment: Money;
  interest: Money;
  principal: Money;
  remainingBalance: Money;
  activeTranche: number;
  days: number;
};

export type ImportedTrancheMortgageResult = {
  purchasePrice: Money;
  downPayment: Money;
  loanAmount: Money;
  annualRatePercent: string;
  loanTermMonths: number;
  trancheTotal: Money;
  difference: Money;
  isBalanced: boolean;
  validationMessages: string[];
  stages: ImportedTrancheStage[];
  schedule: ImportedTranchePayment[];
  remainingBalance: Money;
  totalInterest: Money;
  totalPayments: Money;
};

export type ImportedMortgageResult = {
  purchasePrice: Money;
  downPayment: Money;
  loanAmount: Money;
  annualRatePercent: string;
  loanTermMonths: number;
  monthlyPayment: Money;
  totalPayment: Money;
  overpayment: Money;
  validationMessages: string[];
};

export type ProposalPayment =
  | { mode: "INSTALLMENT"; inputs: Extract<ProposalPaymentInput, { mode: "INSTALLMENT" }>; result: ImportedInstallmentResult }
  | { mode: "TRANCHE_MORTGAGE"; inputs: Extract<ProposalPaymentInput, { mode: "TRANCHE_MORTGAGE" }>; result: ImportedTrancheMortgageResult }
  | { mode: "MORTGAGE"; inputs: Extract<ProposalPaymentInput, { mode: "MORTGAGE" }>; result: ImportedMortgageResult };

export interface CreateProposalContextRequest { unitId: string; payment: ProposalPaymentInput; investment: ProposalInvestmentInput | null }
export interface UnitSnapshot { unitId: string; unitNumber: string; floor: number; area: number | null; price: Money; pricePerSqm: Money | null; status: string; viewType: string | null; capturedAt: string }
export interface ProposalContext { id: string; projectId: string; unitId: string; unitSnapshot: UnitSnapshot; payment: ProposalPayment; investment: { model: ProposalInvestmentInput["model"]; scenario: string; inputs: ProposalInvestmentInput; result: unknown } | null; schemaVersion: number; paymentEngineVersion: string; investmentEngineVersion: string; createdAt: string; expiresAt: string | null }
export interface ProposalContextResponse { data: ProposalContext; liveCheck: { priceChanged: boolean; statusChanged: boolean; currentPrice: Money | null; currentStatus: string } }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const fail = (path: string): never => { throw new Error(`INVALID_PROPOSAL_CONTEXT:${path}`); };
const record = (value: unknown, path: string) => isRecord(value) ? value : fail(path);
const string = (value: unknown, path: string) => typeof value === "string" ? value : fail(path);
const number = (value: unknown, path: string) => typeof value === "number" && Number.isFinite(value) ? value : fail(path);
const integer = (value: unknown, path: string) => Number.isSafeInteger(number(value, path)) ? value as number : fail(path);
const boolean = (value: unknown, path: string) => typeof value === "boolean" ? value : fail(path);
const nullableString = (value: unknown, path: string) => value === null ? null : string(value, path);
const money = (value: unknown, path: string) => integer(value, path) as Money;
const nullableMoney = (value: unknown, path: string) => value === null ? null : money(value, path);
const array = (value: unknown, path: string) => Array.isArray(value) ? value : fail(path);

function parsePaymentSchedule(value: unknown): ImportedPaymentScheduleItem[] {
  return array(value, "payment.result.schedule").map((item, index) => {
    const row = record(item, `payment.result.schedule[${index}]`);
    const type = string(row.type, `payment.result.schedule[${index}].type`);
    if (!["DOWN_PAYMENT", "MONTHLY", "INTERMEDIATE", "FINAL"].includes(type)) fail(`payment.result.schedule[${index}].type`);
    return { id: string(row.id, `payment.result.schedule[${index}].id`), date: string(row.date, `payment.result.schedule[${index}].date`), type: type as ImportedPaymentScheduleItem["type"], label: string(row.label, `payment.result.schedule[${index}].label`), amount: money(row.amount, `payment.result.schedule[${index}].amount`), cumulativeAmount: money(row.cumulativeAmount, `payment.result.schedule[${index}].cumulativeAmount`), balanceAfter: money(row.balanceAfter, `payment.result.schedule[${index}].balanceAfter`) };
  });
}

function parseInstallment(value: unknown): ImportedInstallmentResult {
  const result = record(value, "payment.result");
  return { purchasePrice: money(result.purchasePrice, "payment.result.purchasePrice"), discountedPrice: money(result.discountedPrice, "payment.result.discountedPrice"), discountAmount: money(result.discountAmount, "payment.result.discountAmount"), downPayment: money(result.downPayment, "payment.result.downPayment"), downPaymentPercent: string(result.downPaymentPercent, "payment.result.downPaymentPercent"), financedAmount: money(result.financedAmount, "payment.result.financedAmount"), monthlyPayment: money(result.monthlyPayment, "payment.result.monthlyPayment"), requiredEscrowAmount: money(result.requiredEscrowAmount, "payment.result.requiredEscrowAmount"), requiredEscrowDate: string(result.requiredEscrowDate, "payment.result.requiredEscrowDate"), keyTopUpPayment: money(result.keyTopUpPayment, "payment.result.keyTopUpPayment"), finalPayment: money(result.finalPayment, "payment.result.finalPayment"), totalScheduledPayments: money(result.totalScheduledPayments, "payment.result.totalScheduledPayments"), remainingBalance: money(result.remainingBalance, "payment.result.remainingBalance"), schedule: parsePaymentSchedule(result.schedule) };
}

function parseTrancheMortgage(value: unknown): ImportedTrancheMortgageResult {
  const result = record(value, "payment.result");
  const stages = array(result.stages, "payment.result.stages").map((item, index) => { const row = record(item, `payment.result.stages[${index}]`); return { trancheId: string(row.trancheId, `payment.result.stages[${index}].trancheId`), trancheNumber: integer(row.trancheNumber, `payment.result.stages[${index}].trancheNumber`), trancheAmount: money(row.trancheAmount, `payment.result.stages[${index}].trancheAmount`), issueDate: string(row.issueDate, `payment.result.stages[${index}].issueDate`), paymentCount: integer(row.paymentCount, `payment.result.stages[${index}].paymentCount`), outstandingAfterIssue: money(row.outstandingAfterIssue, `payment.result.stages[${index}].outstandingAfterIssue`), monthlyPayment: money(row.monthlyPayment, `payment.result.stages[${index}].monthlyPayment`), balanceBeforeNextTranche: money(row.balanceBeforeNextTranche, `payment.result.stages[${index}].balanceBeforeNextTranche`) }; });
  const schedule = array(result.schedule, "payment.result.schedule").map((item, index) => { const row = record(item, `payment.result.schedule[${index}]`); return { date: string(row.date, `payment.result.schedule[${index}].date`), payment: money(row.payment, `payment.result.schedule[${index}].payment`), interest: money(row.interest, `payment.result.schedule[${index}].interest`), principal: money(row.principal, `payment.result.schedule[${index}].principal`), remainingBalance: money(row.remainingBalance, `payment.result.schedule[${index}].remainingBalance`), activeTranche: integer(row.activeTranche, `payment.result.schedule[${index}].activeTranche`), days: integer(row.days, `payment.result.schedule[${index}].days`) }; });
  return { purchasePrice: money(result.purchasePrice, "payment.result.purchasePrice"), downPayment: money(result.downPayment, "payment.result.downPayment"), loanAmount: money(result.loanAmount, "payment.result.loanAmount"), annualRatePercent: string(result.annualRatePercent, "payment.result.annualRatePercent"), loanTermMonths: integer(result.loanTermMonths, "payment.result.loanTermMonths"), trancheTotal: money(result.trancheTotal, "payment.result.trancheTotal"), difference: money(result.difference, "payment.result.difference"), isBalanced: boolean(result.isBalanced, "payment.result.isBalanced"), validationMessages: array(result.validationMessages, "payment.result.validationMessages").map((item, index) => string(item, `payment.result.validationMessages[${index}]`)), stages, schedule, remainingBalance: money(result.remainingBalance, "payment.result.remainingBalance"), totalInterest: money(result.totalInterest, "payment.result.totalInterest"), totalPayments: money(result.totalPayments, "payment.result.totalPayments") };
}

function parsePayment(value: unknown): ProposalPayment {
  const payment = record(value, "payment");
  const inputs = record(payment.inputs, "payment.inputs");
  const mode = string(payment.mode, "payment.mode");
  if (string(inputs.mode, "payment.inputs.mode") !== mode) fail("payment.inputs.mode");
  if (mode === "INSTALLMENT") return { mode, inputs: { mode, startDate: string(inputs.startDate, "payment.inputs.startDate"), programId: string(inputs.programId, "payment.inputs.programId") }, result: parseInstallment(payment.result) };
  if (mode === "TRANCHE_MORTGAGE") { const count = integer(inputs.trancheCount, "payment.inputs.trancheCount"); if (![1, 2, 3].includes(count)) fail("payment.inputs.trancheCount"); return { mode, inputs: { mode, startDate: string(inputs.startDate, "payment.inputs.startDate"), downPaymentPercent: number(inputs.downPaymentPercent, "payment.inputs.downPaymentPercent"), annualRatePercent: string(inputs.annualRatePercent, "payment.inputs.annualRatePercent"), termYears: number(inputs.termYears, "payment.inputs.termYears"), trancheCount: count as 1 | 2 | 3 }, result: parseTrancheMortgage(payment.result) }; }
  if (mode === "MORTGAGE") fail("payment.mode:MORTGAGE_NOT_SUPPORTED_BY_IMPORTED_PROPOSAL");
  return fail("payment.mode");
}

export function parseProposalContextResponse(value: unknown): ProposalContextResponse {
  const root = record(value, "root");
  const data = record(root.data, "data");
  const schemaVersion = integer(data.schemaVersion, "data.schemaVersion");
  if (schemaVersion !== PROPOSAL_CONTEXT_SCHEMA_VERSION) throw new Error("UNSUPPORTED_PROPOSAL_CONTEXT_VERSION");
  const unit = record(data.unitSnapshot, "data.unitSnapshot");
  const live = record(root.liveCheck, "liveCheck");
  const investmentValue = data.investment;
  const investment = investmentValue === null ? null : record(investmentValue, "data.investment") as ProposalContext["investment"];
  return { data: { id: string(data.id, "data.id"), projectId: string(data.projectId, "data.projectId"), unitId: string(data.unitId, "data.unitId"), unitSnapshot: { unitId: string(unit.unitId, "data.unitSnapshot.unitId"), unitNumber: string(unit.unitNumber, "data.unitSnapshot.unitNumber"), floor: integer(unit.floor, "data.unitSnapshot.floor"), area: unit.area === null ? null : number(unit.area, "data.unitSnapshot.area"), price: money(unit.price, "data.unitSnapshot.price"), pricePerSqm: nullableMoney(unit.pricePerSqm, "data.unitSnapshot.pricePerSqm"), status: string(unit.status, "data.unitSnapshot.status"), viewType: nullableString(unit.viewType, "data.unitSnapshot.viewType"), capturedAt: string(unit.capturedAt, "data.unitSnapshot.capturedAt") }, payment: parsePayment(data.payment), investment, schemaVersion, paymentEngineVersion: string(data.paymentEngineVersion, "data.paymentEngineVersion"), investmentEngineVersion: string(data.investmentEngineVersion, "data.investmentEngineVersion"), createdAt: string(data.createdAt, "data.createdAt"), expiresAt: nullableString(data.expiresAt, "data.expiresAt") }, liveCheck: { priceChanged: boolean(live.priceChanged, "liveCheck.priceChanged"), statusChanged: boolean(live.statusChanged, "liveCheck.statusChanged"), currentPrice: nullableMoney(live.currentPrice, "liveCheck.currentPrice"), currentStatus: string(live.currentStatus, "liveCheck.currentStatus") } };
}
